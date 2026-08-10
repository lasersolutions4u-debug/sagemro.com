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
HOST_PATTERNS = {
    'customer': r'sagemro\.cn|www\.sagemro\.cn',
    'engineer': r'engineer\.sagemro\.cn',
    'admin': r'admin\.sagemro\.cn',
    'api': r'api\.sagemro\.cn',
}
API_DIRECT_TARGET = 'https://api.sagemro.com'
API_KEEPALIVE_TARGET = 'https://sagemro_api_worker'
API_PROXY_DIRECTIVES = (
    ('proxy_http_version', '1.1', 'proxy_http_version 1.1;'),
    ('proxy_set_header', 'Connection', '""', 'proxy_set_header Connection "";'),
    ('proxy_set_header', 'Host', 'api.sagemro.com', 'proxy_set_header Host api.sagemro.com;'),
    ('proxy_ssl_server_name', 'on', 'proxy_ssl_server_name on;'),
    ('proxy_ssl_name', 'api.sagemro.com', 'proxy_ssl_name api.sagemro.com;'),
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


def root_location_blocks(text):
    code = nginx_code(text)
    start_re = re.compile(r'(?m)^[ \t]*location[ \t]+/[ \t]*\{')
    for match in start_re.finditer(code):
        opening = code.find('{', match.start(), match.end())
        depth = 0
        for index in range(opening, len(code)):
            if code[index] == '{':
                depth += 1
            elif code[index] == '}':
                depth -= 1
                if depth == 0:
                    yield match.start(), index + 1, opening + 1, index
                    break
        else:
            raise ValueError('Unclosed Nginx location / block')


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
    kinds = []
    if names.intersection(('sagemro.cn', 'www.sagemro.cn')):
        kinds.append('customer')
    if 'engineer.sagemro.cn' in names:
        kinds.append('engineer')
    if 'admin.sagemro.cn' in names:
        kinds.append('admin')
    if 'api.sagemro.cn' in names:
        kinds.append('api')

    if 'admin' in kinds and ('customer' in kinds or 'engineer' in kinds):
        raise ValueError('admin.sagemro.cn cannot share a server block with customer or engineer hosts')
    if len(kinds) > 1:
        raise ValueError('Official host kinds cannot share a server block')
    return kinds[0] if kinds else None


def ensure_default_tls_server(block_text):
    code = nginx_code(block_text)
    matches = list(TLS_LISTEN_RE.finditer(code))
    updated = block_text
    for match in reversed(matches):
        directive = block_text[match.start():match.end()]
        if 'default_server' in nginx_tokens(directive):
            continue
        semicolon = directive.rfind(';')
        replacement = directive[:semicolon].rstrip() + ' default_server' + directive[semicolon:]
        updated = updated[:match.start()] + replacement + updated[match.end():]
    return updated


def ensure_host_guard(block_text, kind):
    guard = f'if ($host !~ ^(?:{HOST_PATTERNS[kind]})$) {{ return 444; }}'
    if guard in nginx_code(block_text):
        return block_text

    opening = re.match(r'(?P<prefix>[ \t]*server[ \t]*\{[ \t]*\n)', block_text)
    if opening is None:
        raise ValueError(f'{kind} server must open on its own line')
    indent = re.match(r'[ \t]*', block_text).group(0) + '  '
    return block_text[:opening.end()] + f'{indent}{guard}\n' + block_text[opening.end():]


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


def transform_public_routes(block_text, kind):
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


def transform_api_proxy(block_text):
    location_directives = [
        directive for directive in nginx_directives(block_text)
        if directive[0] == 'location'
    ]
    if location_directives != [('location', '/')]:
        raise ValueError('api server does not contain exactly one recognized API location')

    locations = list(root_location_blocks(block_text))
    if len(locations) != 1:
        raise ValueError('api server does not contain exactly one recognized location / block')

    _, _, body_start, body_end = locations[0]
    body = block_text[body_start:body_end]
    code = nginx_code(body)
    proxy_matches = list(re.finditer(r'(?<!\S)proxy_pass\s+(?P<target>[^;\s]+)\s*;', code))
    if len(proxy_matches) != 1:
        raise ValueError('api server does not contain exactly one recognized API proxy_pass')

    proxy_match = proxy_matches[0]
    target = proxy_match.group('target')
    if target not in (API_DIRECT_TARGET, API_KEEPALIVE_TARGET):
        raise ValueError('api server does not contain a recognized API proxy_pass target')

    updated_body = (
        body[:proxy_match.start('target')]
        + API_KEEPALIVE_TARGET
        + body[proxy_match.end('target'):]
    )

    directives = list(nginx_directives(updated_body))
    allowed_proxy_headers = {'Connection', 'Host'}
    allowed_directive_names = {
        'proxy_pass',
        'proxy_http_version',
        'proxy_set_header',
        'proxy_ssl_server_name',
        'proxy_ssl_name',
    }
    for directive in directives:
        if directive[0] not in allowed_directive_names:
            raise ValueError('api server contains unrecognized API location directives')
        if (
            directive[0] == 'proxy_set_header'
            and (len(directive) < 2 or directive[1] not in allowed_proxy_headers)
        ):
            raise ValueError('api server contains unrecognized API location directives')

    missing = []
    for expected in API_PROXY_DIRECTIVES:
        expected_tokens = expected[:-1]
        expected_line = expected[-1]
        name = expected_tokens[0]
        if name == 'proxy_set_header':
            candidates = [
                directive for directive in directives
                if len(directive) >= 2
                and directive[0] == name
                and directive[1] == expected_tokens[1]
            ]
        else:
            candidates = [directive for directive in directives if directive[0] == name]

        if len(candidates) > 1:
            raise ValueError(f'api server contains duplicate {expected_line.split(";")[0]} directives')
        if candidates:
            if expected_tokens[:2] == ('proxy_set_header', 'Connection'):
                connection_is_empty = (
                    candidates[0] == ('proxy_set_header', 'Connection')
                    and re.search(r'proxy_set_header\s+Connection\s+""\s*;', updated_body)
                )
                if not connection_is_empty:
                    raise ValueError(
                        f'api server contains a conflicting {expected_line.split(";")[0]} directive'
                    )
            elif candidates[0] != expected_tokens:
                raise ValueError(
                    f'api server contains a conflicting {expected_line.split(";")[0]} directive'
                )
        if not candidates:
            missing.append(expected_line)

    if not missing:
        return block_text[:body_start] + updated_body + block_text[body_end:]

    location_line_start = block_text.rfind('\n', 0, body_start) + 1
    location_indent = re.match(r'[ \t]*', block_text[location_line_start:body_start]).group(0)
    directive_indent = location_indent + '  '
    insertion = '\n' + ''.join(f'{directive_indent}{line}\n' for line in missing)
    if updated_body.startswith(('\n', '\r')):
        insertion = insertion.rstrip('\n')
    updated_body = insertion + updated_body
    return block_text[:body_start] + updated_body + block_text[body_end:]


def transform_block(block_text, kind):
    if kind in ('customer', 'engineer'):
        updated = transform_public_routes(block_text, kind)
    elif kind == 'api':
        updated = transform_api_proxy(block_text)
    else:
        updated = block_text
    if kind == 'customer':
        updated = ensure_default_tls_server(updated)
    return ensure_host_guard(updated, kind)


def transform_config(text):
    lines = text.splitlines(keepends=True)
    blocks = list(server_blocks(lines))
    matched = 0
    customer_matched = 0
    api_matched = 0

    for start, end in reversed(blocks):
        block_text = ''.join(lines[start:end])
        kind = server_kind(block_text)
        if kind is None:
            continue
        if kind in ('customer', 'engineer'):
            matched += 1
        if kind == 'customer':
            customer_matched += 1
        if kind == 'api':
            api_matched += 1
        lines[start:end] = transform_block(block_text, kind).splitlines(keepends=True)

    return ''.join(lines), matched, customer_matched, api_matched


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


def update_configs(paths, require_api_proxy=False):
    originals = {}
    updated = {}
    stats = {}
    total_matched = 0
    customer_matched = 0
    api_matched = 0

    for path in paths:
        original = path.read_bytes()
        text = original.decode('utf-8')
        transformed, matched, customers, api_servers = transform_config(text)
        originals[path] = original
        updated[path] = transformed.encode('utf-8')
        stats[path] = path.stat()
        total_matched += matched
        customer_matched += customers
        api_matched += api_servers

    if total_matched == 0:
        raise ValueError('No sagemro.cn customer or engineer server block was found')
    if customer_matched != 1:
        raise ValueError('Expected exactly one customer TLS server block')
    if require_api_proxy and api_matched != 1:
        raise ValueError('Expected exactly one api.sagemro.cn TLS server block')

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

    return total_matched, api_matched, len(written)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--require-api-proxy', action='store_true')
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
        matched, api_matched, changed = update_configs(configs, args.require_api_proxy)
    except (OSError, UnicodeError, ValueError) as error:
        print(f'Error: {error}', file=sys.stderr)
        return 1

    print(
        f'sagemro.cn public server blocks: {matched}; '
        f'API server blocks: {api_matched}; files updated: {changed}'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
