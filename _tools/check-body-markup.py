#!/usr/bin/env python3
"""본문 마크업 점검 (PW-2342).

공개 페이지마다 검색엔진·스크린리더가 읽는 본문 뼈대를 본다 — <head> 는 check-seo-meta.py 몫이다.
  · <h1> 이 하나이고, 제목 단계가 건너뛰지 않는다(h1 다음 바로 h3 이면 안 된다)
  · <header> · <main> · <footer> 랜드마크가 있다
  · <img> 마다 alt 가 있고(꾸밈이면 alt=""), <video> 마다 무엇을 보여 주는지 aria-label 이 있다
  · 링크·버튼 문구가 «자세히»·«더보기»처럼 그것만으로 어디로 가는지 모르는 말이 아니다
/staging/ · /early-access/ 는 검색에서 막은 페이지라 뺀다.

  python3 _tools/check-body-markup.py [폴더]   # 문제가 있으면 줄마다 적고 1 로 끝난다
"""
import pathlib, re, sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent)
SKIP = {'staging', 'early-access'}
VAGUE = {'자세히', '자세히 보기', '더보기', '더 보기', '여기', '여기를 클릭', '클릭', 'more', 'read more', 'click here', 'learn more'}

def text(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s)).strip()

problems = []
for f in sorted(ROOT.glob('**/index.html')):
    rel = f.parent.relative_to(ROOT).as_posix()
    if (rel != '.' and rel.startswith(('_', '.'))) or rel in SKIP:
        continue
    page = '/' + ('' if rel == '.' else rel + '/')
    html = f.read_text(encoding='utf8')
    body = html.split('</head>', 1)[-1]

    levels = [int(m) for m in re.findall(r'<h([1-6])[\s>]', body)]
    if levels.count(1) != 1:
        problems.append(f'{page}: <h1> 이 {levels.count(1)}개')
    for prev, cur in zip(levels, levels[1:]):
        if cur > prev + 1:
            problems.append(f'{page}: 제목 단계가 h{prev} 다음 h{cur} 로 건너뜀')
            break
    for tag in ('header', 'main', 'footer'):
        if not re.search(rf'<{tag}[\s>]', body):
            problems.append(f'{page}: <{tag}> 없음')
    for img in re.findall(r'<img\b[^>]*>', body):
        if not re.search(r'\salt=', img):
            problems.append(f'{page}: alt 없는 이미지 {img[:80]}')
    for vid in re.findall(r'<video\b[^>]*>', body):
        if not re.search(r'\saria-label="[^"]{10,}"', vid):
            problems.append(f'{page}: 대체 글(aria-label) 없는 영상 {vid[:80]}')
    for tag, attrs, inner in re.findall(r'<(a|button)\b([^>]*)>(.*?)</\1>', body, re.S):
        label = re.search(r'aria-label="([^"]*)"', attrs)
        words = (label.group(1) if label else text(inner)).strip().lower()
        if words in VAGUE:
            problems.append(f'{page}: 문구만으로 어디로 가는지 모르는 <{tag}> «{words}»')

for p in problems:
    print(p)
sys.exit(1 if problems else 0)
