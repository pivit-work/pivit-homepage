#!/usr/bin/env python3
"""첫 화면 HTML 에 base64 로 박힌 이미지·영상을 assets/ 파일로 빼고, 그 자리를 /assets/<이름> 으로 바꾼다.

pivit-specs 의 시안(7. Homepage/pivit-homepage-v*.html)은 파일 하나로 열리도록 영상까지 data URI 로 품고 있어
3MB 가 된다. 검색엔진·AI 크롤러는 긴 HTML 을 앞부분만 읽기도 하므로, 배포본은 본문만 남긴다.

  python3 tools/split-media.py <시안.html>        # → index.html + assets/
  python3 tools/split-media.py index.html         # 이미 올린 index.html 을 그 자리에서 정리

파일 이름은 내용 해시라 같은 영상은 같은 이름이 되고, 다시 돌려도 결과가 같다.
작은 것(기본 8KB 미만)과 base64 가 아닌 SVG 는 그대로 둔다.
"""
import base64, hashlib, pathlib, re, sys

EXT = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
       "image/svg+xml": "svg", "video/mp4": "mp4", "video/webm": "webm", "font/woff2": "woff2"}
MIN_BYTES = 8 * 1024
ROOT = pathlib.Path(__file__).resolve().parent.parent

def main(src: str) -> None:
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

    out = re.sub(r"data:([a-z]+/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)", repl, html)
    (ROOT / "index.html").write_text(out, encoding="utf-8")
    for name, n in moved:
        print(f"assets/{name}  {n:,} B")
    print(f"index.html  {len(html.encode()):,} B → {len(out.encode()):,} B")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
