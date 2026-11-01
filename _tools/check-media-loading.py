#!/usr/bin/env python3
"""첫 화면(/) 로딩 점검 (PW-2341).

모바일 회선에서 첫 화면 LCP 가 21.6초였다(2026-11-01 운영 Lighthouse 모바일). 열자마자 6.4MB 를 받았는데,
Pretendard 다섯 벌(한 벌 약 780KB)과 영상 4개(2.4MB)가 대부분이었다. 다시 늘어나지 않게 아래를 본다.
  · 첫 화면 HTML 이 300KB 이하다(영상 · 이미지는 assets/ 파일로)
  · <video> 마다 assets/ 에 있는 첫 장면 이미지와 width · height 가 있다 — 영상이 뜰 때 아래 글이 밀리지 않게
  · 맨 위(.hero) 영상은 바로 받는다 — 첫 장면 이미지(poster)가 첫 화면에서 가장 큰 그림(LCP)이라 <head> 에서 미리 받는다
  · 그 아래 영상은 화면에 들어올 때 받는다 — autoplay 없이 preload="none" + data-lazy-video, 첫 장면 이미지는 data-poster
    (poster 로 적으면 화면 밖이어도 바로 받아 맨 위 그림과 다툰다. 붙이고 재생하는 일은 맨 아래 스크립트가 한다)
  · Pretendard 는 쓰인 글자 조각만 받는 배포본(dynamic-subset)을 쓴다 — 통째 배포본(pretendard.min.css)이면 안 된다

  python3 _tools/check-media-loading.py [폴더]   # 문제가 있으면 줄마다 적고 1 로 끝난다
"""
import pathlib, re, sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent)
MAX_HTML = 300 * 1024

def attr(tag, name):
    m = re.search(r'\s' + name + r'(?:="([^"]*)")?(?=[\s>])', tag)
    return None if m is None else (m.group(1) if m.group(1) is not None else '')

problems = []
f = ROOT / 'index.html'
html = f.read_text(encoding='utf8')
size = len(html.encode('utf8'))
if size > MAX_HTML:
    problems.append(f'/ HTML 이 {size:,} B — 300KB 를 넘는다')

body = html.split('</head>', 1)[-1]
hero_start = body.find('<section class="hero"')
hero_end = body.find('</section>', hero_start)
videos = list(re.finditer(r'<video\b[^>]*>', body))
if not videos:
    problems.append('/ 에 <video> 가 없다 — 점검 대상이 바뀌었으면 이 파일도 고친다')
for m in videos:
    tag = m.group(0)
    src = attr(tag, 'src') or ''
    name = src.rsplit('/', 1)[-1]
    in_hero = hero_start != -1 and hero_start < m.start() < hero_end
    poster = attr(tag, 'poster' if in_hero else 'data-poster')
    if in_hero and poster and f'<link rel="preload" as="image" href="{poster}" fetchpriority="high">' not in html:
        problems.append(f'/ 맨 위 영상 {name}: 첫 장면 이미지를 <head> 에서 미리 받지 않는다')
    if not in_hero and attr(tag, 'poster') is not None:
        problems.append(f'/ 영상 {name}: poster 를 바로 적으면 화면 밖에서도 받는다 — data-poster 로')
    if not poster:
        problems.append(f'/ 영상 {name}: 첫 장면 이미지(' + ('poster' if in_hero else 'data-poster') + ')가 없다')
    elif not (ROOT / poster.lstrip('/')).is_file():
        problems.append(f'/ 영상 {name}: poster {poster} 파일이 없다')
    for k in ('width', 'height'):
        if not (attr(tag, k) or '').isdigit():
            problems.append(f'/ 영상 {name}: {k} 가 없다')
    for k in ('muted', 'loop', 'playsinline'):
        if attr(tag, k) is None:
            problems.append(f'/ 영상 {name}: {k} 가 없다 — 소리 없이 반복 재생해야 한다')
    if in_hero:
        if attr(tag, 'preload') == 'none' or attr(tag, 'autoplay') is None:
            problems.append(f'/ 맨 위 영상 {name}: 바로 받아 재생해야 한다(autoplay, preload="none" 금지)')
    else:
        if attr(tag, 'autoplay') is not None:
            problems.append(f'/ 영상 {name}: autoplay 가 있으면 화면 밖에서도 바로 받는다')
        if attr(tag, 'preload') != 'none':
            problems.append(f'/ 영상 {name}: preload="none" 이 아니다')
        if attr(tag, 'data-lazy-video') is None:
            problems.append(f'/ 영상 {name}: data-lazy-video 가 없어 화면에 들어와도 재생되지 않는다')

if 'IntersectionObserver' not in body or '[data-lazy-video]' not in body:
    problems.append('/ 화면에 들어온 영상을 재생하는 스크립트(IntersectionObserver · [data-lazy-video])가 없다')
if 'pretendard.min.css' in html:
    problems.append('/ Pretendard 통째 배포본(pretendard.min.css)을 받는다 — pretendard-dynamic-subset.min.css 로')

for p in problems:
    print(p)
sys.exit(1 if problems else 0)
