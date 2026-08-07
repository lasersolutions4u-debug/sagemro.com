#!/usr/bin/env python3
import argparse
import os
from pathlib import Path
import re
import sys
import tempfile


SERVER_START_RE = re.compile(r'^\s*server\s*\{')
SERVER_NAME_RE = re.compile(r'\bserver_name\b(?P<names>[^;]*);', re.DOTALL)
TLS_LISTEN_RE = re.compile(r'^\s*listen\s+(?:(?:\[[^\]]+\]|[0-9.]+):)?443\b[^;]*\bssl\b[^;]*;', re.MULTILINE)
LEGACY_FALLBACK_RE = re.compile(
    r'(?m)^(?P<indent>[ \t]*)location\s+/\s*\{\s*try_files\s+\$uri\s+/index\.html\s*;\s*\}'
)
PUBLIC_FALLBACK_RE = re.compile(
    r'(?m)^(?P<indent>[ \t]*)location\s+/\s*\{\s*try_files\s+\$uri\s+\$uri/\s+/404\.html\s+=404\s*;\s*\}'
)
CANONICAL_REDIRECT = 'if ($host = www.sagemro.cn) { return 301 https://sagemro.cn$request_uri; }'
ROUTE_LINES = (
    'location = /activate { try_files /index.html =404; }',
    'location = /engineer { try_files /index.html =404; }',
    'location ~ ^/work-orders/[^/]+$ { try_files /index.html =404; }',
    'location ~ ^(.+)/$ { return 301 https://$host$1; }',
    'location / { try_files $uri $uri/ /404.html =404; }',
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


def server_names(block_text):
    return {
        name.lower()
        for match in SERVER_NAME_RE.finditer(block_text)
        for name in match.group('names').split()
    }


def server_kind(block_text):
    if not TLS_LISTEN_RE.search(block_text):
        return None

    names = server_names(block_text)
    if 'sagemro.cn' in names:
        return 'customer'
    if 'engineer.sagemro.cn' in names:
        return 'engineer'
    return None


def transformed_fallback(block_text):
    matches = list(PUBLIC_FALLBACK_RE.finditer(block_text))
    if len(matches) != 1:
        return False

    indent = matches[0].group('indent')
    required = [f'{indent}{line}' for line in ROUTE_LINES]
    return all(line in block_text for line in required)


def transform_block(block_text, kind):
    legacy_matches = list(LEGACY_FALLBACK_RE.finditer(block_text))
    if len(legacy_matches) == 1:
        match = legacy_matches[0]
        indent = match.group('indent')
        replacement_lines = []
        if kind == 'customer' and CANONICAL_REDIRECT not in block_text:
            replacement_lines.append(f'{indent}{CANONICAL_REDIRECT}')
        replacement_lines.extend(f'{indent}{line}' for line in ROUTE_LINES)
        return block_text[:match.start()] + '\n'.join(replacement_lines) + block_text[match.end():]

    if not legacy_matches and transformed_fallback(block_text):
        if kind != 'customer' or CANONICAL_REDIRECT in block_text:
            return block_text

    raise ValueError(f'{kind} server does not contain exactly one recognized location / fallback')


def transform_config(text):
    lines = text.splitlines(keepends=True)
    blocks = list(server_blocks(lines))
    matched = 0

    for start, end in reversed(blocks):
        block_text = ''.join(lines[start:end])
        kind = server_kind(block_text)
        if kind is None:
            continue
        matched += 1
        lines[start:end] = transform_block(block_text, kind).splitlines(keepends=True)

    return ''.join(lines), matched


def write_atomic(path, content, stat):
    temp_name = None
    try:
        with tempfile.NamedTemporaryFile(
            mode='wb', dir=path.parent, prefix=f'.{path.name}.', delete=False
        ) as temp_file:
            temp_name = temp_file.name
            temp_file.write(content)
            temp_file.flush()
            os.fsync(temp_file.fileno())
        os.chmod(temp_name, stat.st_mode)
        if hasattr(os, 'chown'):
            os.chown(temp_name, stat.st_uid, stat.st_gid)
        os.replace(temp_name, path)
    except Exception:
        if temp_name is not None:
            try:
                os.unlink(temp_name)
            except FileNotFoundError:
                pass
        raise


def update_configs(paths):
    originals = {}
    updated = {}
    stats = {}
    total_matched = 0

    for path in paths:
        original = path.read_bytes()
        text = original.decode('utf-8')
        transformed, matched = transform_config(text)
        originals[path] = original
        updated[path] = transformed.encode('utf-8')
        stats[path] = path.stat()
        total_matched += matched

    if total_matched == 0:
        raise ValueError('No sagemro.cn customer or engineer server block was found')

    written = []
    try:
        for path in paths:
            if updated[path] == originals[path]:
                continue
            write_atomic(path, updated[path], stats[path])
            written.append(path)
    except Exception:
        for path in reversed(written):
            write_atomic(path, originals[path], stats[path])
        raise

    return total_matched, len(written)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('configs', nargs='+', type=Path)
    args = parser.parse_args()

    try:
        matched, changed = update_configs(args.configs)
    except (OSError, UnicodeError, ValueError) as error:
        print(f'Error: {error}', file=sys.stderr)
        return 1

    print(f'sagemro.cn public server blocks: {matched}; files updated: {changed}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
