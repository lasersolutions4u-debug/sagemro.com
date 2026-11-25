#!/usr/bin/env python3
"""Insert or remove a server-level maintenance block in SAGEMRO's nginx config.

Why this exists: the China edition pages are served by nginx on the Aliyun ECS, and
that configuration lives only on the server. Closing those sites therefore needs a
remote change, which is exactly the kind of edit that should be reviewable and
reversible. This script is the single implementation of that change; both the runner
(`pause-cn.sh`) and the CI workflow call it.

Design constraints, each of which is a way this edit could take a site down:

* Only server blocks that declare one of the China hostnames are touched, so an
  unrelated site sharing the config is never modified.
* `api.sagemro.cn` is excluded: it is the reverse proxy for the shared Worker, and
  pausing the API is a separate, deliberate operation.
* A block that already carries a `return` *at server level* is skipped. nginx rejects
  a duplicated `return` in one context, so inserting into a 80->443 redirect block
  would fail `nginx -t`. A `return` inside a `location` is irrelevant and must not
  trigger the skip — detecting that needs real brace depth, not an indent guess.
* Backups are written OUTSIDE the nginx tree. `include /etc/nginx/sites-enabled/*`
  loads every file in that directory, so a `<file>.sagemro-bak` next to a config would
  be parsed as a second copy of it (`nginx -t` then fails with a duplicate
  `default_server`). This actually happened on the first production run.
* Any stale backup left inside the tree by an older run is deleted before editing, so
  nginx cannot pick it up.
* The edit is idempotent in both directions and the removal restores the original bytes.

Usage:
    nginx_maintenance.py on|off|rollback [--root /etc/nginx] [--manifest PATH] [--backup-dir DIR]
    nginx_maintenance.py status   [--root /etc/nginx]
"""

import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import sys

HOSTS = {
    'sagemro.cn',
    'www.sagemro.cn',
    'ai.sagemro.cn',
    'admin.sagemro.cn',
    'engineer.sagemro.cn',
}
EXCLUDED_HOSTS = {'api.sagemro.cn'}

MARK_START = '# >>> sagemro-maintenance >>>'
MARK_END = '# <<< sagemro-maintenance <<<'
BACKUP_SUFFIX = '.sagemro-bak'
DEFAULT_MANIFEST = '/var/backups/sagemro-nginx/last-change.json'

# Single-quoted for nginx: no variable expansion, and the page contains no `'`.
PAGE = (
    '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
    '<meta name="viewport" content="width=device-width,initial-scale=1">'
    '<meta name="robots" content="noindex, nofollow, noarchive">'
    '<title>系统维护中 - SAGEMRO</title><style>'
    'body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;'
    'background:#f4f5f7;color:#17191f;font:16px/1.7 system-ui,sans-serif}'
    'main{width:100%;max-width:32rem;background:#fff;border:1px solid #e3e6eb;'
    'border-radius:14px;padding:32px}h1{margin:0 0 14px;font-size:22px;line-height:1.35}'
    'p{margin:0 0 14px;color:#3d424c}p:last-child{margin:0}a{color:#0b4fd1}'
    '</style></head><body><main><h1>系统维护中</h1>'
    '<p>SAGEMRO 网站正在进行计划内维护，暂时无法访问。我们正在尽快恢复服务，数据不受影响。</p>'
    '<p>需要立即联系：<a href="mailto:support@sagemro.com">support@sagemro.com</a></p>'
    '</main></body></html>'
)


def skip_comment(text, index):
    newline = text.find('\n', index)
    return len(text) if newline == -1 else newline + 1


def skip_quoted(text, index):
    quote = text[index]
    index += 1
    n = len(text)
    while index < n:
        if text[index] == '\\':
            index += 2
            continue
        if text[index] == quote:
            return index + 1
        index += 1
    return index


def find_close(text, open_index):
    """Return the index of the `}` matching the `{` at open_index, or None."""
    depth = 0
    i = open_index
    while i < len(text):
        c = text[i]
        if c == '#':
            i = skip_comment(text, i)
            continue
        if c in '"\'':
            i = skip_quoted(text, i)
            continue
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return None


def scan_server_blocks(text):
    """Return [{'brace', 'close'}] for every `server { ... }`, ignoring comments/strings."""
    blocks = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c == '#':
            i = skip_comment(text, i)
            continue
        if c in '"\'':
            i = skip_quoted(text, i)
            continue
        if c.isalpha() or c == '_':
            j = i
            while j < n and (text[j].isalnum() or text[j] in '_-.'):
                j += 1
            if text[i:j] == 'server':
                k = j
                while k < n and text[k] in ' \t\r\n':
                    k += 1
                if k < n and text[k] == '{':
                    close = find_close(text, k)
                    if close is not None:
                        blocks.append({'brace': k, 'close': close})
                        i = close + 1
                        continue
            i = j
            continue
        i += 1
    return blocks


def top_level_directives(body):
    """Yield (name, line) for directives at server level, i.e. brace depth 0.

    Indentation is not a reliable signal: a `return` directly inside `location /` is
    one level deeper and must not stop the maintenance block from being inserted.
    """
    depth = 0
    i = 0
    n = len(body)
    while i < n:
        c = body[i]
        if c == '#':
            i = skip_comment(body, i)
            continue
        if c in '"\'':
            i = skip_quoted(body, i)
            continue
        if c == '{':
            depth += 1
            i += 1
            continue
        if c == '}':
            depth -= 1
            i += 1
            continue
        if depth == 0 and (c.isalpha() or c == '_'):
            j = i
            while j < n and (body[j].isalnum() or body[j] in '_-.'):
                j += 1
            newline = body.find('\n', i)
            line = body[i:n if newline == -1 else newline].strip()
            yield body[i:j], line
            i = j
            continue
        i += 1


def top_level_line(body, name):
    for token, line in top_level_directives(body):
        if token == name:
            return line
    return None


def server_names(body):
    names = set()
    for match in re.finditer(r'(?m)^\s*server_name\s+([^;]+);', body):
        names.update(match.group(1).split())
    return names


def snippet(indent, include_default_type):
    pad = ' ' * indent
    lines = [
        f'{pad}{MARK_START}',
        f'{pad}# 临时停止对外访问。删除本标记块（到下面的结束标记）即恢复。',
    ]
    if include_default_type:
        lines.append(f'{pad}default_type text/html;')
    lines.append(f"{pad}return 503 '{PAGE}';")
    lines.append(f'{pad}{MARK_END}')
    return lines


def plan_file(text, path=''):
    """Return (new_text, patched_host_sets, skipped) for one config file."""
    edits = []
    skipped = []
    for block in scan_server_blocks(text):
        body = text[block['brace'] + 1:block['close']]
        names = server_names(body)
        if not (names & HOSTS) or (names & EXCLUDED_HOSTS):
            continue
        if MARK_START in body:
            skipped.append((sorted(names), 'already paused'))
            continue
        existing_return = top_level_line(body, 'return')
        if existing_return is not None:
            skipped.append((sorted(names), f'server-level return already present: {existing_return[:70]}'))
            continue
        existing_type = top_level_line(body, 'default_type')
        if existing_type is not None and 'text/html' not in existing_type:
            print(
                f'warning: {path} {sorted(names)} sets "{existing_type[:60]}"; the maintenance page '
                'will be served with that content type instead of text/html',
                file=sys.stderr,
            )
        line_start = text.rfind('\n', 0, block['brace']) + 1
        leading = text[line_start:block['brace']]
        indent = (len(leading) + 4) if leading.strip() == '' else 4
        edits.append((block, snippet(indent, existing_type is None)))

    if not edits:
        return text, [], skipped

    out = text
    for block, lines in reversed(edits):
        out = out[:block['brace'] + 1] + '\n' + '\n'.join(lines) + out[block['brace'] + 1:]
    patched = [sorted(server_names(text[block['brace'] + 1:block['close']]) & HOSTS) for block, _ in edits]
    return out, patched, skipped


def strip_blocks(text):
    pattern = re.compile(
        r'(?ms)^[ \t]*' + re.escape(MARK_START) + r'.*?^[ \t]*' + re.escape(MARK_END) + r'[ \t]*\n?'
    )
    return pattern.sub('', text)


def candidate_files(root):
    """Config files nginx actually loads: `sites-enabled/*` and `conf.d/*.conf`."""
    seen = set()
    for pattern in ('sites-enabled/*', 'conf.d/*.conf'):
        for path in sorted(glob.glob(os.path.join(root, pattern))):
            if not os.path.isfile(path):
                continue
            real = os.path.realpath(path)
            if real in seen:
                continue
            seen.add(real)
            yield path


def stale_backups(root):
    """Backups left inside the nginx tree by an older run.

    nginx includes whole directories, so such a file is parsed as a duplicate config.
    """
    return sorted(glob.glob(os.path.join(root, '**', '*' + BACKUP_SUFFIX), recursive=True))


def remove_stale_backups(root):
    removed = []
    for path in stale_backups(root):
        try:
            os.remove(path)
            removed.append(path)
        except OSError as error:
            print(f'warning: could not remove stale backup {path}: {error}', file=sys.stderr)
    return removed


def read(path):
    # newline='' keeps the file's original line endings, so `off` and `rollback`
    # restore the exact bytes instead of silently normalising CRLF/LF.
    with open(path, 'r', encoding='utf-8', newline='') as handle:
        return handle.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8', newline='') as handle:
        handle.write(text)


def backup_target(path, backup_dir):
    safe = re.sub(r'[^A-Za-z0-9._-]', '_', path.strip('/'))
    digest = hashlib.sha1(path.encode('utf-8')).hexdigest()[:8]
    return os.path.join(backup_dir, f'{digest}__{safe}')


def load_manifest(manifest):
    if not os.path.isfile(manifest):
        return []
    try:
        with open(manifest, 'r', encoding='utf-8') as handle:
            return json.load(handle).get('files', [])
    except (OSError, ValueError) as error:
        print(f'warning: unreadable manifest {manifest}: {error}', file=sys.stderr)
        return []


def save_manifest(manifest, mode, entries):
    os.makedirs(os.path.dirname(manifest) or '.', exist_ok=True)
    with open(manifest, 'w', encoding='utf-8') as handle:
        json.dump({'mode': mode, 'files': entries}, handle, ensure_ascii=False, indent=2)


def apply(mode, root, manifest, backup_dir):
    changed = []
    skipped = []
    patched_hosts = set()
    already_paused = set()

    for stale in remove_stale_backups(root):
        print(f'removed stale in-tree backup: {stale}')

    for path in candidate_files(root):
        original = read(path)
        if mode == 'on':
            updated, blocks, skips = plan_file(original, path)
        else:
            updated, blocks, skips = strip_blocks(original), [], []
        for names, reason in skips:
            skipped.append((path, names, reason))
            if reason == 'already paused':
                already_paused.update(names)
        if updated == original:
            continue
        target = backup_target(path, backup_dir)
        os.makedirs(backup_dir, exist_ok=True)
        shutil.copy2(path, target)
        write(path, updated)
        changed.append((path, target))
        for names in blocks:
            patched_hosts.update(names)

    if changed:
        save_manifest(manifest, mode, [{'path': path, 'backup': backup} for path, backup in changed])

    print(f'mode={mode} root={root}')
    print(f'changed files: {len(changed)}')
    for path, target in changed:
        print(f'  {path}  (backup {target})')
    for path, names, reason in skipped:
        print(f'  skipped {path} {names}: {reason}')

    if mode != 'on':
        return 0

    missing = HOSTS - patched_hosts - already_paused
    if not changed:
        if already_paused:
            print('already paused: nothing to do')
            return 0
        if not skipped:
            print('error: no server block declares a China hostname', file=sys.stderr)
            return 2
        print(f'error: nothing was patched; unmatched: {sorted(missing)}', file=sys.stderr)
        return 2
    if missing:
        print(f'warning: not patched in this run: {sorted(missing)}', file=sys.stderr)
    return 0


def rollback(manifest):
    entries = load_manifest(manifest)
    restored = 0
    for entry in entries:
        path, target = entry.get('path'), entry.get('backup')
        if not path or not target or not os.path.isfile(target):
            print(f'warning: no backup for {path}', file=sys.stderr)
            continue
        shutil.copy2(target, path)
        os.remove(target)
        restored += 1
        print(f'  restored {path}')
    if os.path.isfile(manifest):
        os.remove(manifest)
    print(f'restored files: {restored}')
    return 0 if restored or not entries else 1


def status(root):
    total = 0
    for path in candidate_files(root):
        text = read(path)
        for block in scan_server_blocks(text):
            body = text[block['brace'] + 1:block['close']]
            names = server_names(body)
            if names & HOSTS:
                state = 'PAUSED' if MARK_START in body else 'live'
                total += 1
                print(f'{state:<7} {sorted(names)} {path}')
    for stale in stale_backups(root):
        print(f'WARNING in-tree backup (nginx would load it): {stale}')
    print(f'server blocks for China hosts: {total}')
    return 0


def main(argv):
    parser = argparse.ArgumentParser(description='Close or reopen the China sites in nginx.')
    parser.add_argument('mode', choices=['on', 'off', 'rollback', 'status'])
    parser.add_argument('--root', default='/etc/nginx')
    parser.add_argument('--manifest', default=DEFAULT_MANIFEST)
    parser.add_argument('--backup-dir', default=None)
    args = parser.parse_args(argv)

    backup_dir = args.backup_dir or os.path.join(os.path.dirname(args.manifest) or '.', 'files')

    if args.mode == 'rollback':
        return rollback(args.manifest)
    if args.mode == 'status':
        return status(args.root)
    return apply(args.mode, args.root, args.manifest, backup_dir)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
