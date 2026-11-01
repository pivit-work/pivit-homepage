#!/usr/bin/env python3
"""sitemap.xml 의 <lastmod> 를 페이지마다 그 페이지 파일(<주소>/index.html)이 마지막으로 커밋된 날로 맞춘다 (PW-2336).

페이지를 고친 커밋을 만든 뒤 돌리고, 바뀐 sitemap.xml 을 따로 커밋한다.
check-seo-meta.py 가 lastmod 가 그 날보다 이르면 잡는다.

  python3 _tools/update-sitemap-lastmod.py
"""
import pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
LOC = re.compile(r'(<loc>https://pivit\.work/([^<]*)</loc><lastmod>)([^<]*)(</lastmod>)')

def last_commit_day(rel_path):
    out = subprocess.run(['git', 'log', '-1', '--format=%cd', '--date=short', '--', rel_path],
                         cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    return out or None

def page_file(path):
    return f'{path}index.html'

if __name__ == '__main__':
    sm = ROOT / 'sitemap.xml'
    text = sm.read_text(encoding='utf-8')
    def fix(m):
        day = last_commit_day(page_file(m.group(2))) or m.group(3)
        return m.group(1) + day + m.group(4)
    new = LOC.sub(fix, text)
    sm.write_text(new, encoding='utf-8')
    print('바뀜' if new != text else '그대로')
