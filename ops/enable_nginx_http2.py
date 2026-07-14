#!/usr/bin/env python3
import argparse
import os
from pathlib import Path
import re
import tempfile


SERVER_START_RE = re.compile(r'^\s*server\s*\{')
SERVER_NAME_RE = re.compile(r'\bserver_name\b(?P<names>[^;]*);', re.DOTALL)
TARGET_HOSTS = {'sagemro.cn', 'www.sagemro.cn', 'admin.sagemro.cn', 'engineer.sagemro.cn'}
TLS_LISTEN_RE = re.compile(
    r'^(?P<prefix>\s*listen\s+(?:(?:\[[^\]]+\]|[0-9.]+):)?443\b)(?P<params>[^;]*)(?P<suffix>;.*)$'
)


def brace_delta(line):
    delta = 0
    quote = None
    escaped = False

    for char in line:
        if escaped:
            escaped = False
            continue
        if char == '\\':
            escaped = True
            continue
        if quote:
            if char == quote:
                quote = None
            continue
        if char in ('"', "'"):
            quote = char
            continue
        if char == '#':
            break
        if char == '{':
            delta += 1
        elif char == '}':
            delta -= 1

    return delta


def server_blocks(lines):
    start = None
    depth = 0

    for index, line in enumerate(lines):
        if start is None:
            if not SERVER_START_RE.match(line):
                continue
            start = index
            depth = brace_delta(line)
        else:
            depth += brace_delta(line)

        if start is not None and depth == 0:
            yield start, index + 1
            start = None

    if start is not None:
        raise ValueError('Unclosed Nginx server block')


def is_target_server(block_text):
    return any(
        name.lower() in TARGET_HOSTS
        for match in SERVER_NAME_RE.finditer(block_text)
        for name in match.group('names').split()
    )


def enable_http2_in_block(block_lines):
    updated = []
    tls_listeners = 0
    changed = 0

    for line in block_lines:
        line_ending = '\r\n' if line.endswith('\r\n') else '\n' if line.endswith('\n') else ''
        content = line[:-len(line_ending)] if line_ending else line
        match = TLS_LISTEN_RE.match(content)
        if not match or not re.search(r'(^|\s)ssl(?=\s|$)', match.group('params')):
            updated.append(line)
            continue

        tls_listeners += 1
        params = match.group('params')
        if not re.search(r'(^|\s)http2(?=\s|$)', params):
            params = f'{params} http2'
            changed += 1
        updated.append(f"{match.group('prefix')}{params}{match.group('suffix')}{line_ending}")

    return updated, tls_listeners, changed


def write_atomic(path, content):
    stat = path.stat()
    descriptor, temp_name = tempfile.mkstemp(dir=path.parent, prefix=f'.{path.name}.')
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8', newline='') as temp_file:
            temp_file.write(content)
        os.chmod(temp_name, stat.st_mode)
        if hasattr(os, 'chown'):
            os.chown(temp_name, stat.st_uid, stat.st_gid)
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def update_file(path):
    text = path.read_text(encoding='utf-8')
    lines = text.splitlines(keepends=True)
    target_blocks = 0
    tls_listeners = 0
    changed = 0

    for start, end in list(server_blocks(lines)):
        block_lines = lines[start:end]
        if not is_target_server(''.join(block_lines)):
            continue
        target_blocks += 1
        updated, block_listeners, block_changed = enable_http2_in_block(block_lines)
        lines[start:end] = updated
        tls_listeners += block_listeners
        changed += block_changed

    if changed:
        write_atomic(path, ''.join(lines))

    return target_blocks, tls_listeners, changed


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('configs', nargs='+', type=Path)
    args = parser.parse_args()

    target_blocks = 0
    tls_listeners = 0
    changed = 0

    for config in args.configs:
        file_blocks, file_listeners, file_changed = update_file(config)
        target_blocks += file_blocks
        tls_listeners += file_listeners
        changed += file_changed

    if not target_blocks or not tls_listeners:
        parser.error('No sagemro.cn HTTPS server block was found')

    print(f'sagemro.cn HTTPS blocks: {target_blocks}; TLS listeners: {tls_listeners}; updated: {changed}')


if __name__ == '__main__':
    main()
