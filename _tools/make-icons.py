#!/usr/bin/env python3
"""사이트 아이콘 세 파일을 로고 심볼 한 장에서 만든다 (PW-2340).

  python3 _tools/make-icons.py      # → favicon.ico(16·32·48) · apple-touch-icon.png(180) · icon-512.png(512)

원본은 assets/9b06400edc4a.png(시안에서 뺀 512×557 검은 심볼, 바탕 투명)다. 세로가 길어 그대로는
정사각이 아니고, 검은 심볼이 투명 바탕이라 어두운 브라우저 탭에서 안 보이고 iOS 홈 화면은 투명 자리를
검게 채워 아예 안 보인다. 그래서 흰 정사각 바탕 가운데에 여백을 두고 놓는다.
favicon.ico 만 모서리를 둥글린다 — 탭에서 흰 네모로 튀지 않게. iOS 는 스스로 둥글리므로 180 은 네모 그대로.
"""
import pathlib
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'assets' / '9b06400edc4a.png'
WHITE = (255, 255, 255, 255)

def tile(size: int, pad: float, radius: float = 0) -> Image.Image:
    mark = Image.open(SRC).convert('RGBA')
    mark = mark.crop(mark.getbbox())
    inner = round(size * (1 - 2 * pad))
    scale = inner / max(mark.size)
    mark = mark.resize((max(1, round(mark.width * scale)), max(1, round(mark.height * scale))), Image.LANCZOS)
    big = size * 4  # 둥근 모서리를 매끄럽게 하려고 크게 그려 줄인다
    bg = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    ImageDraw.Draw(bg).rounded_rectangle((0, 0, big - 1, big - 1), radius=round(big * radius), fill=WHITE)
    bg = bg.resize((size, size), Image.LANCZOS)
    bg.alpha_composite(mark, ((size - mark.width) // 2, (size - mark.height) // 2))
    return bg

def main() -> None:
    tile(180, 0.16).convert('RGB').save(ROOT / 'apple-touch-icon.png', optimize=True)
    tile(512, 0.14).convert('RGB').save(ROOT / 'icon-512.png', optimize=True)
    frames = [tile(s, 0.1, 0.22) for s in (48, 32, 16)]
    frames[0].save(ROOT / 'favicon.ico', format='ICO', sizes=[(48, 48), (32, 32), (16, 16)],
                   append_images=frames[1:])

if __name__ == '__main__':
    main()
