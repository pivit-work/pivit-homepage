#!/usr/bin/env python3
"""검색용 기본 메타 점검 (PW-2335).

공개 페이지마다 <title>·description 이 서로 다르고, canonical 이 자기 주소(https://pivit.work/…/)이며,
noindex 가 없고 <html lang="ko"> 인지, 첫 화면 제목에 «피빗»이 있는지 본다. /staging/ · /early-access/ 는 일부러 검색에서 막은 페이지라 뺀다.
약관 페이지(_legal/build.cjs 로 만드는 것)는 description 이 제목 되풀이가 아니게 80~120자인지도 본다.
사이트맵(PW-2336): sitemap.xml 의 <lastmod> 가 그 페이지 파일의 마지막 커밋 날보다 이르지 않은지 본다.
탭 아이콘(PW-2340): 검색에서 막은 두 페이지까지 모든 페이지 머리에 /favicon.ico · /apple-touch-icon.png 두 줄만 있고
다른 아이콘 링크(옛 512×557 파일·data URI)가 없는지, 세 아이콘 파일이 정사각인지 본다.

  python3 _tools/check-seo-meta.py      # 문제가 있으면 줄마다 적고 1 로 끝난다
"""
import pathlib, re, struct, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP = {'staging', 'early-access'}
LEGAL = {'terms', 'privacy', 'policy', 'dpa', 'subprocessors'}

def meta(html, pat):
    m = re.search(pat, html)
    return m.group(1) if m else None

ICON_LINKS = ['<link rel="icon" href="/favicon.ico" sizes="48x48">',
              '<link rel="apple-touch-icon" href="/apple-touch-icon.png">']

def png_size(path):
    b = path.read_bytes()
    return struct.unpack('>II', b[16:24]) if b[:8] == b'\x89PNG\r\n\x1a\n' else None

def ico_sizes(path):
    b = path.read_bytes()
    if b[:4] != b'\x00\x00\x01\x00':
        return []
    return [((b[6 + i * 16] or 256), (b[7 + i * 16] or 256)) for i in range(struct.unpack('<H', b[4:6])[0])]

problems, seen_title, seen_desc = [], {}, {}
for name, want in (('apple-touch-icon.png', (180, 180)), ('icon-512.png', (512, 512))):
    p = ROOT / name
    if not p.exists() or png_size(p) != want:
        problems.append(f'/{name} 이 {want[0]}×{want[1]} 정사각 PNG 가 아님')
if (48, 48) not in ico_sizes(ROOT / 'favicon.ico') if (ROOT / 'favicon.ico').exists() else True:
    problems.append('/favicon.ico 에 48×48 이 없음')

for f in sorted(ROOT.glob('**/index.html')):
    rel = f.parent.relative_to(ROOT).as_posix()
    if rel != '.' and rel.startswith(('_', '.')):
        continue
    url = 'https://pivit.work/' + ('' if rel == '.' else rel + '/')
    h = f.read_text(encoding='utf-8')
    icons = re.findall(r'<link rel="(?:shortcut )?(?:icon|apple-touch-icon)"[^>]*>', h)
    if icons != ICON_LINKS:
        problems.append(f'{url} 아이콘 링크가 {icons}')
    if rel in SKIP:
        continue
    url = 'https://pivit.work/' + ('' if rel == '.' else rel + '/')
    h = f.read_text(encoding='utf-8')
    title = meta(h, r'<title>([^<]*)</title>')
    desc = meta(h, r'<meta name="description" content="([^"]*)"')
    canon = meta(h, r'<link rel="canonical" href="([^"]*)"')
    if not title: problems.append(f'{url} 제목 없음')
    if not desc: problems.append(f'{url} 설명 없음')
    if canon != url: problems.append(f'{url} canonical 이 {canon}')
    if 'noindex' in h: problems.append(f'{url} noindex 있음')
    if '<html lang="ko">' not in h: problems.append(f'{url} html lang="ko" 아님')
    if rel == '.' and '피빗' not in (title or ''):
        problems.append(f'{url} 제목에 한글 이름 «피빗» 없음')
    if title in seen_title: problems.append(f'{url} 제목이 {seen_title[title]} 와 같음')
    if desc in seen_desc: problems.append(f'{url} 설명이 {seen_desc[desc]} 와 같음')
    seen_title[title], seen_desc[desc] = url, url
    if rel in LEGAL and desc and (not 80 <= len(desc) <= 120 or title and desc in title):
        problems.append(f'{url} 설명이 {len(desc)}자이거나 제목 되풀이')

import importlib.util
_spec = importlib.util.spec_from_file_location('lastmod', ROOT / '_tools' / 'update-sitemap-lastmod.py')
lastmod = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(lastmod)
for m in lastmod.LOC.finditer((ROOT / 'sitemap.xml').read_text(encoding='utf-8')):
    day = lastmod.last_commit_day(lastmod.page_file(m.group(2)))
    if day and m.group(3) < day:
        problems.append(f'sitemap.xml 의 https://pivit.work/{m.group(2)} lastmod {m.group(3)} 이 마지막 수정일 {day} 보다 이름 — python3 _tools/update-sitemap-lastmod.py')

print('\n'.join(problems) or f'통과 — 페이지 {len(seen_title)}개')
sys.exit(1 if problems else 0)
