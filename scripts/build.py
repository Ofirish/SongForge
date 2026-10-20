#!/usr/bin/env python3
"""Build Song Forge into one standalone file: index.html at the repo root.

The app is written as small modules under src/. This script stitches them,
in the order listed in src/modules.json, into a single HTML page that works
opened straight from disk, on GitHub Pages, or published as a Claude artifact.

Usage:  python3 scripts/build.py          # writes index.html
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

if __name__ == '__main__':
    out = build()
    target = ROOT / 'index.html'
    if '--check' in sys.argv:
        if not target.exists() or target.read_text(encoding='utf-8') != out:
            print('index.html is out of date. Run: python3 scripts/build.py'); sys.exit(1)
        print('index.html is up to date.'); sys.exit(0)
    target.write_text(out, encoding='utf-8')
    print(f'Wrote {target.relative_to(ROOT)} ({len(out.encode()) // 1024} KB)')
