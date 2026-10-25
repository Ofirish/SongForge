#!/usr/bin/env python3
"""Build Tabwright into one standalone file.

The app is written as small modules under src/. This script stitches them,
in the order listed in src/modules.json, into:

  index.html          a complete HTML document (doctype, charset, viewport) for
                      GitHub Pages and for opening straight from disk
  dist/artifact.html  the same page as body content only, for publishing as a
                      Claude artifact (the viewer adds its own document skeleton)

Usage:  python3 scripts/build.py          # writes both files
        python3 scripts/build.py --check  # exit 1 if index.html is out of date
"""
import json, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'

def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')

def group(files):
    return '\n'.join(f'/* ---- {f} ---- */\n' + read(f) for f in files)

def build():
    mods = json.loads(read('src/modules.json'))
    html = read('src/index.template.html')
    parts = {
        '/*CSS*/': read('src/styles.css'),
        '/*SAMPLE*/null': json.dumps(json.loads(read('src/data/sample-song.json')), ensure_ascii=False),
        '/*CORE*/': group(mods['core']),
        '/*UI*/': group(mods['app']),
        '/*FONTS*/null': read('src/vendor/fonts.json').strip(),
        '/*JSPDF*/': read('src/vendor/jspdf.umd.min.js'),
        '/*PDF*/': group(mods['pdf']),
    }
    for k, v in parts.items():
        assert html.count(k) == 1, f'placeholder {k} must appear exactly once in the template'
        assert '</script' not in v.lower() or k == '/*CSS*/', f'{k} contains a closing script tag'
        html = html.replace(k, v)
    return html

def standalone(content):
    """Wrap the page content in a full document: head items (title, meta, fonts, styles) go in <head>."""
    split = content.index('<div class="app">')
    head, body = content[:split].strip(), content[split:].strip()
    return ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
            '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>\n'
            f'{head}\n</head>\n<body>\n{body}\n</body>\n</html>\n')

if __name__ == '__main__':
    content = build()
    page = standalone(content)
    target = ROOT / 'index.html'
    if '--check' in sys.argv:
        if not target.exists() or target.read_text(encoding='utf-8') != page:
            print('index.html is out of date. Run: python3 scripts/build.py'); sys.exit(1)
        print('index.html is up to date.'); sys.exit(0)
    target.write_text(page, encoding='utf-8')
    (ROOT / 'dist').mkdir(exist_ok=True)
    (ROOT / 'dist' / 'artifact.html').write_text(content, encoding='utf-8')
    print(f'Wrote index.html ({len(page.encode()) // 1024} KB) and dist/artifact.html')
