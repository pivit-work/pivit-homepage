#!/usr/bin/env python3
"""검색용 기본 메타 점검 (PW-2335).

공개 페이지마다 <title>·description 이 서로 다르고, canonical 이 자기 주소(https://pivit.work/…/)이며,
noindex 가 없고 <html lang="ko"> 인지, 첫 화면 제목에 «피빗»이 있는지 본다. /staging/ · /early-access/ 는 일부러 검색에서 막은 페이지라 뺀다.
약관 페이지(_legal/build.cjs 로 만드는 것)는 description 이 제목 되풀이가 아니게 80~120자인지도 본다.

  python3 _tools/check-seo-meta.py      # 문제가 있으면 줄마다 적고 1 로 끝난다
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SKIP = {'staging', 'early-access'}
LEGAL = {'terms', 'privacy', 'policy', 'dpa', 'subprocessors'}

def meta(html, pat):
    m = re.search(pat, html)
    return m.group(1) if m else None

problems, seen_title, seen_desc = [], {}, {}
for f in sorted(ROOT.glob('**/index.html')):
    rel = f.parent.relative_to(ROOT).as_posix()
    if (rel != '.' and rel.startswith(('_', '.'))) or rel in SKIP:
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

print('\n'.join(problems) or f'통과 — 페이지 {len(seen_title)}개')
sys.exit(1 if problems else 0)
