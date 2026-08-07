#!/usr/bin/env python3
import argparse
import os
from pathlib import Path
import re
import sys
import tempfile


SERVER_START_RE = re.compile(r'^\s*server\s*\{')
TLS_LISTEN_RE = re.compile(r'^\s*listen\s+(?:(?:\[[^\]]+\]|[0-9.]+):)?443\b[^;]*\bssl\b[^;]*;', re.MULTILINE)
LEGACY_FALLBACK_RE = re.compile(
    r'(?m)^(?P<indent>[ \t]*)location\s+/\s*\{\s*try_files\s+\$uri(?:\s+\$uri/)?\s+/index\.html\s*;\s*\}'
)
PUBLIC_FALLBACK_RE = re.compile(
    r'(?m)^(?P<indent>[ \t]*)location\s+/\s*\{\s*try_files\s+\$uri\s+\$uri/\s+=404\s*;\s*\}'
)
LEGACY_TRAILING_REDIRECT_RE = re.compile(
    r'(?m)^[ \t]*location\s+~\s+\^\(\.\+\)/\$\s*\{\s*return\s+301\s+https://\$host\$1\s*;\s*\}[ \t]*(?:\n|$)'
)
CANONICAL_REDIRECT = 'if ($host = www.sagemro.cn) { return 301 https://sagemro.cn$request_uri; }'
ROUTE_LINES = (
    'error_page 404 /404.html;',
    'location = /404.html { internal; }',
    'location = /activate { try_files /index.html =404; }',
    'location = /engineer { try_files /index.html =404; }',
    'location ~ ^/work-orders/[^/]+$ { try_files /index.html =404; }',
    'location / { try_files $uri $uri/ =404; }',
)


def nginx_code(text):
    code = []
    quote = None
    escaped = False
    comment = False

    for char in text:
        if comment:
            if char == '\n':
                comment = False
                code.append(char)
            else:
                code.append(' ')
            continue

        if quote:
            if escaped:
                escaped = False
            elif char == '\\':
                escaped = True
            elif char == quote:
                quote = None
            code.append(char if char == '\n' else ' ')
            continue

        if char == '#':
            comment = True
            code.append(' ')
        elif char in ('"', "'"):
            quote = char
            code.append(' ')
        else:
            code.append(char)

    return ''.join(code)


def nginx_tokens(text):
    tokens = []
    token = []
    quote = None
    escaped = False
    comment = False

    def finish_token():
        if token:
            tokens.append(''.join(token))
            token.clear()

    for char in text:
        if comment:
            if char == '\n':
                comment = False
            continue

        if quote:
            if escaped:
                token.append(char)
                escaped = False
            elif char == '\\':
                token.append(char)
                escaped = True
            elif char == quote:
                quote = None
            else:
                token.append(char)
            continue

        if char == '#':
            finish_token()
            comment = True
        elif char in ('"', "'"):
            quote = char
        elif char.isspace():
            finish_token()
        elif char in ';{}':
            finish_token()
            tokens.append(char)
        else:
            token.append(char)

    finish_token()
    return tokens


def nginx_directives(text):
    directive = []
    for token in nginx_tokens(text):
        if token in (';', '{'):
            if directive:
                yield tuple(directive)
                directive = []
        elif token == '}':
            directive = []
        else:
            directive.append(token)


def brace_delta(line):
    return line.count('{') - line.count('}')


def server_blocks(lines):
    start = None
    depth = 0
    code_lines = nginx_code(''.join(lines)).splitlines(keepends=True)

    for index, line in enumerate(code_lines):
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
        for directive in nginx_directives(block_text)
        if directive[0] == 'server_name'
        for name in directive[1:]
    }


def server_kind(block_text):
    code = nginx_code(block_text)
    if not TLS_LISTEN_RE.search(code):
        return None

    names = server_names(block_text)
    if 'admin.sagemro.cn' in names and (
        'sagemro.cn' in names or 'engineer.sagemro.cn' in names
    ):
        raise ValueError('admin.sagemro.cn cannot share a server block with customer or engineer hosts')
    if 'sagemro.cn' in names:
        return 'customer'
    if 'engineer.sagemro.cn' in names:
        return 'engineer'
    return None


def has_canonical_redirect(block_text):
    directives = list(nginx_directives(block_text))
    has_www_condition = any(
        directive[0] == 'if'
        and '$host' in ' '.join(directive[1:])
        and 'www.sagemro.cn' in ' '.join(directive[1:])
        for directive in directives
    )
    has_canonical_return = any(
        directive == ('return', '301', 'https://sagemro.cn$request_uri')
        for directive in directives
    )
    return has_www_condition and has_canonical_return


def has_route_conflict(block_text):
    for directive in nginx_directives(block_text):
        name, *arguments = directive
        if name == 'error_page' and any(argument.lstrip('=') == '404' for argument in arguments):
            return True
        if name != 'location' or not arguments:
            continue

        modifier = arguments[0] if arguments[0] in ('=', '~', '~*', '^~') else None
        uri_index = 1 if modifier else 0
        if uri_index >= len(arguments):
            continue
        uri = arguments[uri_index]
        if modifier == '=' and uri in ('/404.html', '/activate', '/engineer'):
            return True
        if modifier in ('~', '~*') and (
            'work-orders' in uri or ('(.+)' in uri and uri.endswith('/$'))
        ):
            return True
    return False


def transformed_fallback(block_text):
    code = nginx_code(block_text)
    matches = list(PUBLIC_FALLBACK_RE.finditer(code))
    if len(matches) != 1:
        return False

    indent = matches[0].group('indent')
    required = [f'{indent}{line}' for line in ROUTE_LINES]
    return all(line in code for line in required)


def transform_block(block_text, kind):
    code = nginx_code(block_text)
    legacy_matches = list(LEGACY_FALLBACK_RE.finditer(code))
    if len(legacy_matches) == 1:
        if has_route_conflict(block_text):
            raise ValueError(f'{kind} server conflicts with generated public route directives')
        match = legacy_matches[0]
        indent = match.group('indent')
        replacement_lines = []
        if kind == 'customer' and not has_canonical_redirect(block_text):
            replacement_lines.append(f'{indent}{CANONICAL_REDIRECT}')
        replacement_lines.extend(f'{indent}{line}' for line in ROUTE_LINES)
        return block_text[:match.start()] + '\n'.join(replacement_lines) + block_text[match.end():]

    if not legacy_matches and transformed_fallback(block_text):
        if kind == 'customer' and not has_canonical_redirect(block_text):
            raise ValueError('customer server is missing the canonical www redirect')
        reverse_redirects = list(LEGACY_TRAILING_REDIRECT_RE.finditer(code))
        if len(reverse_redirects) > 1:
            raise ValueError(f'{kind} server contains duplicate generated trailing-slash redirects')
        if reverse_redirects:
            match = reverse_redirects[0]
            return block_text[:match.start()] + block_text[match.end():]
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
        if hasattr(os, 'chown'):
            os.chown(temp_name, stat.st_uid, stat.st_gid)
        os.chmod(temp_name, stat.st_mode)
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
    except Exception as write_error:
        rollback_errors = []
        for path in reversed(written):
            try:
                write_atomic(path, originals[path], stats[path])
            except Exception as rollback_error:
                rollback_errors.append(f'{path}: {rollback_error}')
        if rollback_errors:
            details = '; '.join(rollback_errors)
            raise OSError(f'{write_error}; rollback failures: {details}') from write_error
        raise

    return total_matched, len(written)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('configs', nargs='+', type=Path)
    args = parser.parse_args()

    try:
        configs = []
        seen = set()
        for config in args.configs:
            resolved = config.resolve(strict=True)
            stat = resolved.stat()
            if stat.st_nlink > 1:
                raise ValueError(f'Refusing hard-linked Nginx config: {resolved}')
            identity = (stat.st_dev, stat.st_ino)
            if identity in seen:
                raise ValueError(f'Refusing duplicate Nginx config inode: {resolved}')
            seen.add(identity)
            configs.append(resolved)
        matched, changed = update_configs(configs)
    except (OSError, UnicodeError, ValueError) as error:
        print(f'Error: {error}', file=sys.stderr)
        return 1

    print(f'sagemro.cn public server blocks: {matched}; files updated: {changed}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
