#!/usr/bin/env python3
"""첫 화면 HTML 에 base64 로 박힌 이미지·영상을 assets/ 파일로 빼고, 그 자리를 /assets/<이름> 으로 바꾼다.

pivit-specs 의 시안(7. Homepage/pivit-homepage-v*.html)은 파일 하나로 열리도록 영상까지 data URI 로 품고 있어
3MB 가 된다. 검색엔진·AI 크롤러는 긴 HTML 을 앞부분만 읽기도 하므로, 배포본은 본문만 남긴다.

  python3 _tools/split-media.py <시안.html>        # → index.html + assets/
  python3 _tools/split-media.py index.html         # 이미 올린 index.html 을 그 자리에서 정리
  python3 _tools/split-media.py okr/index.html okr/index.html   # 출력 경로를 주면 그 파일로 쓴다(기능 페이지)

파일 이름은 내용 해시라 같은 영상은 같은 이름이 되고, 다시 돌려도 결과가 같다.
작은 것(기본 8KB 미만)과 base64 가 아닌 SVG 는 그대로 둔다.
시안의 탭 아이콘(<link rel="icon"> data URI, 512×557)은 파일로 빼지 않고 루트의 정사각 아이콘 두 줄로 바꾼다 (PW-2340).
"""
import base64, hashlib, pathlib, re, sys

EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
       "image/svg+xml": "svg", "video/mp4": "mp4", "video/webm": "webm", "font/woff2": "woff2"}
MIN_BYTES = 8 * 1024
# 모든 페이지 머리에 같은 두 줄 — _legal/build.cjs 와 _tools/check-seo-meta.py 도 같은 글자를 쓴다.
ICON_LINKS = '<link rel="icon" href="/favicon.ico" sizes="48x48">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">\n<meta name="apple-mobile-web-app-title" content="Pivit">'
ICON_RE = re.compile(r'(?:<link rel="(?:shortcut icon|icon|apple-touch-icon)"|<meta name="apple-mobile-web-app-title")[^>]*>\n?')
ROOT = pathlib.Path(__file__).resolve().parent.parent

def main(src: str, dst: str = "") -> None:
    html = pathlib.Path(src).read_text(encoding="utf-8")
    assets = ROOT / "assets"
    assets.mkdir(exist_ok=True)
    moved = []

    def repl(m: re.Match) -> str:
        mime, payload = m.group(1), m.group(2)
        ext = EXT.get(mime)
        if not ext or len(payload) * 3 // 4 < MIN_BYTES:
            return m.group(0)
        data = base64.b64decode(payload)
        name = f"{hashlib.sha256(data).hexdigest()[:12]}.{ext}"
        (assets / name).write_bytes(data)
        moved.append((name, len(data)))
        return f"/assets/{name}"

    first = ICON_RE.search(html)
    if first:
        # 첫 아이콘 자리에 아이콘 두 줄과 홈 화면 이름 한 줄을 넣고 나머지 아이콘 링크는 지운다. 넣은 줄도 ICON_RE 에 걸리므로 지운 뒤에 넣는다.
        html = html[:first.start()] + "\0ICON\0" + ICON_RE.sub("", html[first.start():])
        html = html.replace("\0ICON\0", ICON_LINKS + ("\n" if first.group(0).endswith("\n") else ""), 1)
    out = re.sub(r"data:([a-z]+/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)", repl, html)
    target = pathlib.Path(dst) if dst else ROOT / "index.html"
    target.write_text(out, encoding="utf-8")
    for name, n in moved:
        print(f"assets/{name}  {n:,} B")
    print(f"{target.name if not dst else dst}  {len(html.encode()):,} B → {len(out.encode()):,} B")

if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    main(*sys.argv[1:])
