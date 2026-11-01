#!/usr/bin/env python3
"""구조화 데이터(JSON-LD) 점검 (PW-2339).

공개 페이지마다 <head> 의 application/ld+json 을 본다 — 제목·설명·아이콘 링크는 check-seo-meta.py 몫이다.
  · 모든 JSON-LD 가 JSON 으로 읽힌다
  · FAQPage 의 질문·답이 그 페이지 화면 글자와 같다(태그를 걷고 공백만 하나로 모아 비교)
  · 첫 화면: WebSite 의 name 이 «Pivit», alternateName 에 «피빗»·«PIVIT.WORK» — 구글은 검색 결과 위 «사이트 이름»을 여기서 읽는다
  · 첫 화면: Organization 의 name·alternateName(«피빗»)·url, logo 가 이 저장소에 있는 정사각 PNG 의 절대 주소
  · sameAs 는 회사 공식 채널이 생길 때만 넣는다 — 지금은 없어야 한다
/staging/ · /early-access/ 는 검색에서 막은 페이지라 뺀다.

  python3 _tools/check-jsonld.py [폴더]   # 문제가 있으면 줄마다 적고 1 로 끝난다
"""
import html as H, json, pathlib, re, struct, sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parent.parent)
SKIP = {'staging', 'early-access'}
SITE = 'https://pivit.work/'


def text(s):
    return re.sub(r'\s+', ' ', H.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()


def png_size(path):
    b = path.read_bytes()
    return struct.unpack('>II', b[16:24]) if b[:8] == b'\x89PNG\r\n\x1a\n' else None


def nodes(html, where, problems):
    out = []
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', html, re.S):
        try:
            d = json.loads(m.group(1))
        except ValueError as e:
            problems.append(f'{where}: JSON-LD 가 JSON 으로 안 읽힘 — {e}')
            continue
        out += d.get('@graph', [d])
    return out


def names(v):
    return v if isinstance(v, list) else [v]


problems = []
pages = [p for p in sorted(ROOT.glob('*/index.html')) if p.parent.name not in SKIP and not p.parent.name.startswith('_')]
for page in [ROOT / 'index.html'] + pages:
    where = '/' + (page.parent.relative_to(ROOT).as_posix() + '/' if page.parent != ROOT else '')
    html = page.read_text()
    graph = nodes(html, where, problems)
    screen = text(re.sub(r'<script.*?</script>|<style.*?</style>|<!--.*?-->|<head>.*?</head>', '', html, flags=re.S))
    for n in graph:
        if n.get('@type') != 'FAQPage':
            continue
        for q in n.get('mainEntity', []):
            if text(q['name']) not in screen:
                problems.append(f'{where}: FAQ 질문이 화면에 없음 — {q["name"]}')
            if text(q['acceptedAnswer']['text']) not in screen:
                problems.append(f'{where}: FAQ 답이 화면 글자와 다름 — {q["name"]}')
    if where != '/':
        continue
    by = {n.get('@type'): n for n in graph}
    for t in ('Organization', 'WebSite', 'FAQPage'):
        if t not in by:
            problems.append(f'/: {t} 가 없음')
    site, org = by.get('WebSite', {}), by.get('Organization', {})
    if site:
        if site.get('name') != 'Pivit' or site.get('url') != SITE:
            problems.append('/: WebSite 의 name·url 이 «Pivit» · https://pivit.work/ 가 아님')
        for want in ('피빗', 'PIVIT.WORK'):
            if want not in names(site.get('alternateName', [])):
                problems.append(f'/: WebSite alternateName 에 «{want}» 가 없음')
    if org:
        if org.get('name') != 'Pivit' or org.get('url') != SITE or '피빗' not in names(org.get('alternateName', [])):
            problems.append('/: Organization 의 name·url·alternateName(«피빗»)이 카드 값과 다름')
        logo = org.get('logo', '')
        local = ROOT / logo[len(SITE):] if logo.startswith(SITE) else None
        size = png_size(local) if local and local.exists() else None
        if not size or size[0] != size[1]:
            problems.append(f'/: Organization logo 가 이 저장소의 정사각 PNG 절대 주소가 아님 — {logo} {size}')
        if 'sameAs' in org:
            problems.append('/: Organization sameAs 가 있음 — 회사 공식 채널이 생기기 전에는 넣지 않는다')

for p in problems:
    print(p)
print(f'JSON-LD 점검: 페이지 {1 + len(pages)}개 · 문제 {len(problems)}건')
sys.exit(1 if problems else 0)
