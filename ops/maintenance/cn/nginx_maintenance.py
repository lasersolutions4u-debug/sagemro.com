#!/usr/bin/env python3
"""Insert or remove a server-level maintenance block in SAGEMRO's nginx config.

Why this exists: the China edition pages are served by nginx on the Aliyun ECS, and
that configuration lives only on the server. Closing those sites therefore needs a
remote change, which is exactly the kind of edit that should be reviewable and
reversible. This script is the single implementation of that change; both the
runbook (`pause-cn.sh`) and the CI workflow call it.

Design constraints, each of which is a way this edit could take a site down:

* Only server blocks that declare one of the China hostnames are touched, so an
  unrelated site sharing the config is never modified.
* `api.sagemro.cn` is excluded: it is the reverse proxy for the shared Worker, and
  pausing the API is a separate, deliberate operation.
* A block that already carries a server-level `return` is skipped. nginx rejects a
  duplicated `return` in one context, so inserting into a 80->443 redirect block
  would fail `nginx -t` and abort the whole change.
* `default_type` is only added when the block does not already set one, for the same
  reason.
* The edit is idempotent in both directions and the removal restores the original
  bytes exactly.
* Every touched file is backed up next to itself and listed in a manifest, so the
  caller can roll the whole thing back after a failed `nginx -t`.

Usage:
    nginx_maintenance.py on|off|rollback [--root /etc/nginx] [--manifest PATH]
    nginx_maintenance.py status   [--root /etc/nginx]
"""

import argparse
import glob
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
DEFAULT_MANIFEST = '/var/backups/sagemro-nginx/last-change.txt'

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


def find_close(text, open_index):
    """Return the index of the `}` matching the `{` at open_index, or None."""
    depth = 0
    i = open_index
    n = len(text)
    while i < n:
        c = text[i]
        if c == '#':
            newline = text.find('\n', i)
            i = n if newline == -1 else newline + 1
            continue
        if c in '"\'':
            quote = c
            i += 1
            while i < n:
                if text[i] == '\\':
                    i += 2
                    continue
                if text[i] == quote:
                    i += 1
                    break
                i += 1
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
    """Yield {brace, close} for every `server { ... }`, ignoring comments/strings."""
    blocks = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        if c == '#':
            newline = text.find('\n', i)
            i = n if newline == -1 else newline + 1
            continue
        if c in '"\'':
            quote = c
            i += 1
            while i < n:
                if text[i] == '\\':
                    i += 2
                    continue
                if text[i] == quote:
                    i += 1
                    break
                i += 1
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


def server_names(body):
    names = set()
    for match in re.finditer(r'(?m)^\s*server_name\s+([^;]+);', body):
        names.update(match.group(1).split())
    return names


def has_top_level(body, directive):
    """True when `directive` appears at server level (indent <= 4 spaces)."""
    return re.search(r'(?m)^[ \t]{0,4}' + directive + r'\s', body) is not None


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


def plan_file(text):
    """Return (new_text, changed_blocks, skipped) for one config file."""
    edits = []
    skipped = []
    for block in scan_server_blocks(text):
        body = text[block['brace'] + 1:block['close']]
        names = server_names(body)
        targets = names & HOSTS
        if not targets or (names & EXCLUDED_HOSTS):
            continue
        if MARK_START in body:
            skipped.append((sorted(names), 'already paused'))
            continue
        if has_top_level(body, 'return'):
            skipped.append((sorted(names), 'server-level return already present'))
            continue
        indent = 4
        line_start = text.rfind('\n', 0, block['brace']) + 1
        leading = text[line_start:block['brace']]
        if leading.strip() == '':
            indent = len(leading) + 4
        edits.append((block, snippet(indent, not has_top_level(body, 'default_type'))))

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
    """Config files nginx actually loads: `sites-enabled/*` and `conf.d/*.conf`.

    Backups written next to the originals are skipped: `conf.d/*.conf` would not load
    them, but a looser glob here would edit them and double-report the change.
    """
    seen = set()
    for pattern in ('sites-enabled/*', 'conf.d/*.conf'):
        for path in sorted(glob.glob(os.path.join(root, pattern))):
            if not os.path.isfile(path) or path.endswith(BACKUP_SUFFIX):
                continue
            real = os.path.realpath(path)
            if real in seen:
                continue
            seen.add(real)
            yield path


def read(path):
    # newline='' keeps the file's original line endings, so `off` and `rollback`
    # restore the exact bytes instead of silently normalising CRLF/LF.
    with open(path, 'r', encoding='utf-8', newline='') as handle:
        return handle.read()


def write(path, text):
    with open(path, 'w', encoding='utf-8', newline='') as handle:
        handle.write(text)


def backup(path):
    bak = path + BACKUP_SUFFIX
    if not os.path.exists(bak):
        shutil.copy2(path, bak)
    return bak


def load_manifest(manifest):
    if not os.path.isfile(manifest):
        return []
    return [line.strip() for line in read(manifest).splitlines() if line.strip()]


def save_manifest(manifest, paths):
    os.makedirs(os.path.dirname(manifest) or '.', exist_ok=True)
    write(manifest, ''.join(p + '\n' for p in paths))


def apply(mode, root, manifest):
    changed = []
    skipped = []
    patched_hosts = set()

    for path in candidate_files(root):
        original = read(path)
        if mode == 'on':
            updated, blocks, skips = plan_file(original)
        else:
            updated = strip_blocks(original)
            blocks, skips = [], []
        skipped.extend((path, names, reason) for names, reason in skips)
        if updated == original:
            continue
        backup(path)
        write(path, updated)
        changed.append(path)
        for names in blocks:
            patched_hosts.update(names)

    if changed:
        save_manifest(manifest, changed)

    print(f'mode={mode} root={root}')
    print(f'changed files: {len(changed)}')
    for path in changed:
        print(f'  {path}')
    for path, names, reason in skipped:
        print(f'  skipped {path} {names}: {reason}')

    if mode == 'on':
        missing = HOSTS - patched_hosts - {
            name for _, names, reason in skipped for name in names if reason == 'already paused'
        }
        if not changed and not skipped:
            print('error: no server block declares a China hostname', file=sys.stderr)
            return 2
        if missing and not changed:
            print(f'error: no host was patched; unmatched: {sorted(missing)}', file=sys.stderr)
            return 2
        if missing:
            print(f'warning: not patched in this run: {sorted(missing)}', file=sys.stderr)
    return 0


def rollback(manifest):
    paths = load_manifest(manifest)
    restored = 0
    for path in paths:
        bak = path + BACKUP_SUFFIX
        if not os.path.isfile(bak):
            print(f'warning: no backup for {path}', file=sys.stderr)
            continue
        shutil.copy2(bak, path)
        os.remove(bak)
        restored += 1
        print(f'  restored {path}')
    if os.path.isfile(manifest):
        os.remove(manifest)
    print(f'restored files: {restored}')
    return 0 if restored or not paths else 1


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
    print(f'server blocks for China hosts: {total}')
    return 0


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('mode', choices=['on', 'off', 'rollback', 'status'])
    parser.add_argument('--root', default='/etc/nginx')
    parser.add_argument('--manifest', default=DEFAULT_MANIFEST)
    args = parser.parse_args(argv)

    if args.mode == 'rollback':
        return rollback(args.manifest)
    if args.mode == 'status':
        return status(args.root)
    return apply(args.mode, args.root, args.manifest)


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
