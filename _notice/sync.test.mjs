// node --test _notice/   — 공고 사본 동기화 (PW-2255)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { plan, write, attachmentPath } from './sync.mjs';

const API = 'https://app.test/api/public/notices';
const pdf = Buffer.from('%PDF-1.4 대차대조표');

function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'notice-'));
  fs.mkdirSync(path.join(root, 'notice/data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'notice/index.html'), '<html><head><title>공고 — Pivit</title>\n<meta name="description" content="공고 목록 설명">\n<link rel="canonical" href="https://pivit.work/notice/"></head></html>');
  fs.writeFileSync(path.join(root, 'notice/data/list.json'), '{"items":[]}\n');
  return root;
}

const one = { no: 1, category: 'general', title: '주주명부 기준일 설정 공고', body: '본문\n둘째 줄', publishedAt: '2027-01-05T01:00:00.000Z', periodBasis: 'fixed_date', periodEndsOn: '2027-01-20' };
const three = { no: 3, category: 'settlement', title: '제1기 대차대조표 공고', body: '결산', publishedAt: '2027-03-31T01:00:00.000Z', periodBasis: 'settlement_two_years', periodEndsOn: '2029-03-30', attachment: { name: '제1기_대차대조표.pdf', size: pdf.length, url: '/api/public/notices/3/attachment' } };
const row = (d) => ({ no: d.no, category: d.category, title: d.title, publishedAt: d.publishedAt, periodEndsOn: d.periodEndsOn, isCorrection: false, isCorrected: false });

function fakeApi(details, { failList = false } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    const json = (b) => new Response(JSON.stringify(b), { status: 200 });
    if (url.startsWith(`${API}?page=`)) {
      if (failList) return new Response('', { status: 502 });
      return json({ items: details.map(row), page: 1, totalPages: 1, total: details.length });
    }
    if (url === 'https://app.test/api/public/notices/3/attachment') return new Response(pdf, { status: 200 });
    const d = details.find((x) => url === `${API}/${x.no}`);
    return d ? json(d) : new Response('', { status: 404 });
  };
  return { fetchImpl, calls };
}

test('목록 · 본문 · 첨부 · 공고별 주소 파일을 만든다', async () => {
  const root = site();
  const files = await plan({ api: API, root, fetchImpl: fakeApi([three, one]).fetchImpl });
  write(root, files);
  const list = JSON.parse(fs.readFileSync(path.join(root, 'notice/data/list.json'), 'utf8'));
  assert.deepEqual(list.items.map((i) => i.no), [3, 1]);
  const d3 = JSON.parse(fs.readFileSync(path.join(root, 'notice/data/3.json'), 'utf8'));
  assert.equal(d3.attachment.url, '/notice/files/3/' + encodeURIComponent('제1기_대차대조표.pdf'));
  assert.ok(fs.readFileSync(path.join(root, attachmentPath(3, '제1기_대차대조표.pdf'))).equals(pdf));
  assert.match(fs.readFileSync(path.join(root, 'notice/1/index.html'), 'utf8'), /<title>제1호 주주명부 기준일 설정 공고 — 공고 — Pivit<\/title>/);
});

test('API 가 실패하면 아무 파일도 쓰지 않는다 — 이전 사본이 그대로 열린다', async () => {
  const root = site();
  write(root, await plan({ api: API, root, fetchImpl: fakeApi([one]).fetchImpl }));
  const before = fs.readFileSync(path.join(root, 'notice/data/list.json'), 'utf8');
  await assert.rejects(plan({ api: API, root, fetchImpl: fakeApi([one], { failList: true }).fetchImpl }), /502/);
  await assert.rejects(plan({ api: API, root, fetchImpl: async () => { throw new Error('연결 끊김'); } }), /연결 끊김/);
  assert.equal(fs.readFileSync(path.join(root, 'notice/data/list.json'), 'utf8'), before);
});

test('사본에 있던 공고가 응답에서 빠지면 실패한다(지우지 않는다)', async () => {
  const root = site();
  write(root, await plan({ api: API, root, fetchImpl: fakeApi([three, one]).fetchImpl }));
  await assert.rejects(plan({ api: API, root, fetchImpl: fakeApi([one]).fetchImpl }), /제3호/);
  assert.ok(fs.existsSync(path.join(root, 'notice/data/3.json')));
});

test('사본과 본문이 다르면 실패한다 · 정정 관계가 느는 것은 받는다', async () => {
  const root = site();
  write(root, await plan({ api: API, root, fetchImpl: fakeApi([one]).fetchImpl }));
  await assert.rejects(plan({ api: API, root, fetchImpl: fakeApi([{ ...one, body: '바뀐 본문' }]).fetchImpl }), /body/);
  const two = { ...one, no: 2, title: '정정', corrects: { no: 1 }, publishedAt: '2027-01-06T00:00:00.000Z' };
  const files = await plan({ api: API, root, fetchImpl: fakeApi([two, { ...one, correctedBy: [{ no: 2 }] }]).fetchImpl });
  assert.match(String(files.get('notice/data/1.json')), /"correctedBy"/);
});

test('같은 내용이면 파일을 다시 쓰지 않는다 · 첨부는 한 번만 받는다', async () => {
  const root = site();
  write(root, await plan({ api: API, root, fetchImpl: fakeApi([three]).fetchImpl }));
  const again = fakeApi([three]);
  assert.deepEqual(write(root, await plan({ api: API, root, fetchImpl: again.fetchImpl })), []);
  assert.ok(!again.calls.some((u) => u.endsWith('/attachment')));
});

test('첨부 이름의 / 는 경로를 벗어나지 못한다', () => {
  assert.equal(attachmentPath(3, '.hidden.pdf'), 'notice/files/3/f.hidden.pdf');
  assert.equal(attachmentPath(3, '_x.pdf'), 'notice/files/3/f_x.pdf');
  const p = attachmentPath(3, '../../index.html');
  assert.ok(p.startsWith('notice/files/3/'));
  assert.ok(!p.slice('notice/files/3/'.length).includes('/'));
});

test('첨부 하나를 못 받아도 다른 공고는 올라간다 · 다음 회차에 다시 받는다', async () => {
  const root = site();
  const api = fakeApi([three, one]);
  const broken = async (url) => (url.endsWith('/attachment') ? new Response('', { status: 503 }) : api.fetchImpl(url));
  const files = await plan({ api: API, root, fetchImpl: broken });
  assert.match(files.warnings[0], /제3호 첨부/);
  write(root, files);
  assert.ok(fs.existsSync(path.join(root, 'notice/data/1.json')));
  assert.ok(fs.existsSync(path.join(root, 'notice/data/3.json')));
  assert.ok(!fs.existsSync(path.join(root, attachmentPath(3, '제1기_대차대조표.pdf'))));
  write(root, await plan({ api: API, root, fetchImpl: api.fetchImpl }));
  assert.ok(fs.existsSync(path.join(root, attachmentPath(3, '제1기_대차대조표.pdf'))));
});

test('제목에 $ 글자가 있어도 title 이 깨지지 않는다', async () => {
  const root = site();
  const odd = { ...one, title: "가$'나$&다" };
  const files = await plan({ api: API, root, fetchImpl: fakeApi([odd]).fetchImpl });
  assert.match(String(files.get('notice/1/index.html')), /<title>제1호 가\$'나\$&amp;다 — 공고 — Pivit<\/title>/);
});

test('공고마다 주소 파일의 canonical 은 자기 주소, 설명은 그 공고 것 — 검색에 목록 한 장으로 묶이지 않는다', async () => {
  const root = site();
  const files = await plan({ api: API, root, fetchImpl: fakeApi([three, one]).fetchImpl });
  const h3 = String(files.get('notice/3/index.html'));
  assert.match(h3, /<link rel="canonical" href="https:\/\/pivit\.work\/notice\/3\/">/);
  assert.match(h3, /<meta name="description" content="주식회사 피빗 제3호 공고\(결산공고\) — 제1기 대차대조표 공고">/);
  assert.match(String(files.get('notice/1/index.html')), /<meta name="description" content="주식회사 피빗 제1호 공고\(일반 공고\) — 주주명부 기준일 설정 공고">/);
  assert.doesNotMatch(h3, /공고 목록 설명|href="https:\/\/pivit\.work\/notice\/">/);
});

test('공고마다 주소 파일 머리 맨 앞에 <base href="/notice/"> — 셸의 상대 주소(../style.css · notice.js · data/)가 한 칸 아래 폴더에서도 목록과 같은 곳을 가리킨다', async () => {
  const root = site();
  const files = await plan({ api: API, root, fetchImpl: fakeApi([three, one]).fetchImpl });
  const h3 = String(files.get('notice/3/index.html'));
  assert.match(h3, /^<html><head>\n {2}<base href="\/notice\/">\n?<title>/);
  assert.equal((h3.match(/<base /g) || []).length, 1);
  assert.doesNotMatch(fs.readFileSync(path.join(root, 'notice/index.html'), 'utf8'), /<base /);
});

test('여러 쪽을 받는 사이 새 공고가 게시돼 쪽 경계가 밀려도 같은 공고가 목록에 두 번 들어가지 않는다', async () => {
  const root = site();
  const r1 = row(one), r3 = row(three);
  const fetchImpl = async (url) => {
    const json = (b) => new Response(JSON.stringify(b), { status: 200 });
    if (url === `${API}?page=1`) return json({ items: [r3], page: 1, totalPages: 2, total: 2 });
    if (url === `${API}?page=2`) return json({ items: [r3, r1], page: 2, totalPages: 2, total: 3 });
    if (url === 'https://app.test/api/public/notices/3/attachment') return new Response(pdf, { status: 200 });
    const d = [one, three].find((x) => url === `${API}/${x.no}`);
    return d ? json(d) : new Response('', { status: 404 });
  };
  const files = await plan({ api: API, root, fetchImpl });
  assert.deepEqual(JSON.parse(String(files.get('notice/data/list.json'))).items.map((i) => i.no), [3, 1]);
});

test('공고별 주소 파일의 링크 미리보기 제목 · 설명 · 주소가 그 공고 것이다 — 메신저에 붙여도 «공고» 목록 미리보기가 뜨지 않는다 (PW-2344)', async () => {
  const root = site();
  // 실제 게시 셸(notice/index.html)을 그대로 써야 셸의 og 태그가 바뀌는지 본다.
  fs.copyFileSync(new URL('../notice/index.html', import.meta.url), path.join(root, 'notice/index.html'));
  const files = await plan({ api: API, root, fetchImpl: fakeApi([one]).fetchImpl });
  const h = String(files.get('notice/1/index.html'));
  const tag = (attr, key) => (h.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`)) ?? [])[1];
  assert.equal(tag('property', 'og:url'), 'https://pivit.work/notice/1/');
  assert.equal(tag('property', 'og:title'), '제1호 주주명부 기준일 설정 공고 — 공고 — Pivit');
  assert.equal(tag('property', 'og:description'), '주식회사 피빗 제1호 공고(일반 공고) — 주주명부 기준일 설정 공고');
  assert.equal(tag('name', 'twitter:title'), '제1호 주주명부 기준일 설정 공고 — 공고 — Pivit');
  assert.equal(tag('name', 'twitter:description'), '주식회사 피빗 제1호 공고(일반 공고) — 주주명부 기준일 설정 공고');
  // 이미지 · 이미지 설명 · 띠 색은 셸 값을 그대로 이어받는다 — 값 자체는 _tools/check-seo-meta.py 가 기획서와 대 본다.
  // (여기 고정값을 적으면 이미지를 ?v=2 로 바꿀 때 5분마다 도는 공고 동기화가 테스트에서 멈춘다.)
  const shell = fs.readFileSync(new URL('../notice/index.html', import.meta.url), 'utf8');
  for (const [attr, key] of [['property', 'og:image'], ['property', 'og:image:alt'], ['name', 'twitter:image'], ['name', 'theme-color']]) {
    const want = (shell.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)">`)) ?? [])[1];
    assert.ok(want, `셸에 ${key} 없음`);
    assert.equal(tag(attr, key), want);
  }
  assert.equal((h.match(/<meta property="og:title"/g) ?? []).length, 1);
});

test('공고 제목에 따옴표 · $ 가 있어도 미리보기 태그가 깨지지 않는다 (PW-2344)', async () => {
  const root = site();
  fs.copyFileSync(new URL('../notice/index.html', import.meta.url), path.join(root, 'notice/index.html'));
  const files = await plan({ api: API, root, fetchImpl: fakeApi([{ ...one, title: '가"나$&다' }]).fetchImpl });
  const h = String(files.get('notice/1/index.html'));
  assert.match(h, /<meta property="og:title" content="제1호 가&quot;나\$&amp;다 — 공고 — Pivit">/);
  assert.match(h, /<meta name="twitter:description" content="주식회사 피빗 제1호 공고\(일반 공고\) — 가&quot;나\$&amp;다">/);
});

test('셸 태그가 <meta … /> 로 닫혀도 공고 것으로 바뀐다(미리보기 저장소 셸)', async () => {
  const root = site();
  const shell = '<html><head><title>공고 — Pivit</title>\n<meta name="description" content="공고 목록 설명" />\n<link rel="canonical" href="https://pivit.work/notice/" />\n<meta property="og:title" content="공고 — Pivit" /></head></html>';
  fs.writeFileSync(path.join(root, 'notice/index.html'), shell);
  const h3 = String((await plan({ api: API, root, fetchImpl: fakeApi([three, one]).fetchImpl })).get('notice/3/index.html'));
  assert.match(h3, /<meta name="description" content="주식회사 피빗 제3호 공고\(결산공고\) — 제1기 대차대조표 공고">/);
  assert.match(h3, /<link rel="canonical" href="https:\/\/pivit\.work\/notice\/3\/">/);
  assert.match(h3, /<meta property="og:title" content="제3호 /);
  assert.doesNotMatch(h3, /공고 목록 설명|content="공고 — Pivit"/);
});
