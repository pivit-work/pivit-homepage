#!/usr/bin/env python3
"""검색용 기본 메타 점검 (PW-2335).

공개 페이지마다 <title>·description 이 서로 다르고, canonical 이 자기 주소(https://pivit.work/…/)이며,
noindex 가 없고 <html lang="ko"> 인지, 첫 화면 제목에 «피빗»이 있는지 본다. /staging/ · /early-access/ 는 일부러 검색에서 막은 페이지라 뺀다.
약관 페이지(_legal/build.cjs 로 만드는 것)는 description 이 제목 되풀이가 아니게 80~120자인지도 본다.
사이트맵(PW-2336): sitemap.xml 의 <lastmod> 가 그 페이지 파일의 마지막 커밋 날보다 이르지 않은지 본다.
탭 아이콘(PW-2340): 검색에서 막은 두 페이지까지 모든 페이지 머리에 /favicon.ico · /apple-touch-icon.png 두 줄과 아이폰 홈 화면 이름(apple-mobile-web-app-title «Pivit», 없으면 페이지 제목이 잘려 붙는다)만 있고
다른 아이콘 링크(옛 512×557 파일·data URI)가 없는지, 세 아이콘 파일이 정사각인지 본다.
링크 미리보기(PW-2344 · pivit-specs 7. Homepage/spec-homepage-link-preview.md): /staging/ 을 뺀 모든 공개 페이지에 og: · twitter: · theme-color 가
한 번씩 있고, og:url 이 자기 주소, twitter 값이 og 값과 같고, 이미지 · 이미지 설명 · 띠 색이 기획서 값인지, 첫 화면 · 약관 등 5페이지는
미리보기 제목 · 설명이 기획서 §3 · §4 값인지 본다. 이미지를 바꿀 때(§6)는 아래 OG_IMAGE · OG_IMAGE_ALT 를 기획서와 함께 바꾼다.

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
              '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
              '<meta name="apple-mobile-web-app-title" content="Pivit">']

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
    icons = re.findall(r'<link rel="(?:shortcut )?(?:icon|apple-touch-icon)"[^>]*>|<meta name="apple-mobile-web-app-title"[^>]*>', h)
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
    # 11-11 새 셸은 <html lang="ko" class="no-js"> 라 속성이 더 붙어도 lang 만 본다.
    if not re.search(r'<html\b[^>]*\blang="ko"', h): problems.append(f'{url} html lang="ko" 아님')
    if rel == '.' and '피빗' not in (title or ''):
        problems.append(f'{url} 제목에 한글 이름 «피빗» 없음')
    if title in seen_title: problems.append(f'{url} 제목이 {seen_title[title]} 와 같음')
    if desc in seen_desc: problems.append(f'{url} 설명이 {seen_desc[desc]} 와 같음')
    seen_title[title], seen_desc[desc] = url, url
    if rel in LEGAL and desc and (not 80 <= len(desc) <= 120 or title and desc in title):
        problems.append(f'{url} 설명이 {len(desc)}자이거나 제목 되풀이')

# 링크 미리보기 — 값은 기획서 문장 그대로 적는다(구현 쪽 값을 읽어 와 비교하면 둘 다 틀려도 통과한다).
OG_IMAGE = 'https://pivit.work/assets/og-image.jpg?v=2'
OG_IMAGE_ALT = '푸른 하늘과 초록 언덕을 배경으로 가운데에 Pivit 로고가 있고, 언덕 위 책상에서 한 사람이 컴퓨터로 일하는 그림입니다.'
OG_FIXED = {('property', 'og:type'): 'website', ('property', 'og:site_name'): 'Pivit', ('property', 'og:locale'): 'ko_KR',
            ('property', 'og:image'): OG_IMAGE, ('property', 'og:image:width'): '1200', ('property', 'og:image:height'): '630',
            ('property', 'og:image:alt'): OG_IMAGE_ALT, ('name', 'twitter:card'): 'summary_large_image',
            ('name', 'twitter:image'): OG_IMAGE, ('name', 'theme-color'): '#2dbd82'}
OG_TEXT = {  # 페이지 → (og:title, og:description). 없는 페이지는 미리보기 제목 · 설명이 자유(지금 값 유지 · 기획서 §1).
    '.': ('Pivit(피빗) — 회사의 사람과 시간, 한눈에 보입니다',
          '누가 어디에 시간을 쓰는지, 새 일을 맡길 사람은 누구인지, 그 시간이 목표로 이어지는지. 팀이 남기는 기록으로 한 화면에 봅니다.'),
    'terms': ('PIVIT.WORK 서비스 이용약관 — Pivit',
              'PIVIT.WORK(피빗) 이용약관 — 이용계약, 서비스 제공과 중단, 요금·결제·환불, 이용자의 의무, AI 기능 특약을 정합니다.'),
    'privacy': ('개인정보처리방침 — Pivit',
                '주식회사 피빗이 처리하는 개인정보의 항목·목적·보유 기간, 위탁과 국외 이전, 정보주체의 권리와 행사 방법을 알립니다.'),
    'policy': ('PIVIT.WORK 운영정책 — Pivit',
               'PIVIT.WORK 운영정책 — 금지 행위의 세부 기준, 위반 때의 조치·통지·이의신청 절차, 보안 취약점 신고 방법을 정합니다.'),
    'dpa': ('PIVIT.WORK 개인정보 처리위탁계약서 — Pivit',
            '고객사가 임직원 개인정보 처리를 주식회사 피빗에 맡길 때의 계약서입니다. 위탁 범위, 안전 조치, 재위탁, 유출 통지, 반환과 파기를 정합니다.'),
    'subprocessors': ('PIVIT.WORK 재수탁자(하위 수탁자) 목록 — Pivit',
                      'PIVIT.WORK 가 고객사 데이터 처리를 다시 맡기는 곳(재수탁자)의 목록입니다. 맡기는 업무와 바뀔 때 알리는 절차를 싣습니다.'),
}
OG_KEYS = list(OG_FIXED) + [('property', k) for k in ('og:url', 'og:title', 'og:description')] + [('name', k) for k in ('twitter:title', 'twitter:description')]

def og_problems(url, h, rel):
    out = []
    def vals(attr, key):
        return re.findall(rf'<meta {attr}="{re.escape(key)}" content="([^"]*)">', h)
    got = {}
    for attr, key in OG_KEYS:
        v = vals(attr, key)
        if len(v) != 1:
            out.append(f'{url} 미리보기 태그 {key} 가 {len(v)}개'); continue
        got[key] = v[0]
    for (attr, key), want in OG_FIXED.items():
        if key in got and got[key] != want: out.append(f'{url} {key} 가 «{got[key]}» (기획서 값 «{want}»)')
    if got.get('og:url') not in (None, url): out.append(f'{url} og:url 이 {got["og:url"]}')
    for o, t in (('og:title', 'twitter:title'), ('og:description', 'twitter:description')):
        if o in got and t in got and got[o] != got[t]: out.append(f'{url} {t} 가 {o} 와 다름')
    if rel in OG_TEXT:
        for key, want in zip(('og:title', 'og:description'), OG_TEXT[rel]):
            if key in got and got[key] != want: out.append(f'{url} {key} 가 «{got[key]}» (기획서 값 «{want}»)')
    if len(got.get('og:description', '')) > 80 and rel in OG_TEXT:
        out.append(f'{url} og:description 이 80자를 넘음')
    return out

for f in sorted(ROOT.glob('**/index.html')):
    rel = f.parent.relative_to(ROOT).as_posix()
    if rel != '.' and rel.startswith(('_', '.')) or rel == 'staging' or rel.startswith('notice/'):
        continue  # 공고 하나하나의 주소(notice/<번호>/)는 _notice/sync.test.mjs 가 본다
    problems += og_problems('https://pivit.work/' + ('' if rel == '.' else rel + '/'), f.read_text(encoding='utf-8'), rel)
for rel in OG_TEXT:
    if not (ROOT / ('index.html' if rel == '.' else f'{rel}/index.html')).exists():
        problems.append(f'{rel} 페이지 파일이 없음 — 미리보기 값 검사를 못 함')

import importlib.util
_spec = importlib.util.spec_from_file_location('lastmod', ROOT / '_tools' / 'update-sitemap-lastmod.py')
lastmod = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(lastmod)
for m in lastmod.LOC.finditer((ROOT / 'sitemap.xml').read_text(encoding='utf-8')):
    day = lastmod.last_commit_day(lastmod.page_file(m.group(2)))
    if day and m.group(3) < day:
        problems.append(f'sitemap.xml 의 https://pivit.work/{m.group(2)} lastmod {m.group(3)} 이 마지막 수정일 {day} 보다 이름 — python3 _tools/update-sitemap-lastmod.py')

print('\n'.join(problems) or f'통과 — 페이지 {len(seen_title)}개')
sys.exit(1 if problems else 0)
