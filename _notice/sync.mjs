// 회사 공고 사본 동기화 (PW-2255) — 앱 공개 API 에서 게시된 공고를 읽어 이 사이트 안에 옮겨 둔다.
//
//   node _notice/sync.mjs                    # 기본: https://app.pivit.work/api/public/notices
//   NOTICE_API=http://localhost:3111/api/public/notices node _notice/sync.mjs
//
// 왜 사본인가: 공고 화면이 앱 API 를 부르면 앱이 멈춘 시간이 곧 공고 «중단»이다(상법 시행령 제6조⑥).
// 그래서 이 작업이 5분마다(.github/workflows/notice-sync.yml) 사본을 새로 고치고 화면은 사본만 읽는다.
//
// 🔴 사본은 줄거나 바뀌지 않는다. 게시한 공고는 고칠 수도 내릴 수도 없으므로, API 가 «이미 사본에 있는 공고»를
// 빠뜨리거나 다르게 주면 그건 앱 쪽 결함이다 — 아무것도 쓰지 않고 실패한다. API 오류도 마찬가지다.
// 바뀐 파일만 쓴다(같으면 건드리지 않는다) — 워크플로가 바뀐 것이 있을 때만 커밋하도록.
//
// _ 로 시작하는 폴더라 GitHub Pages(Jekyll)가 이 폴더를 게시하지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TIMEOUT_MS = 10_000;
/** 게시 뒤 바뀌면 안 되는 칸. 정정 관계(correctedBy)만 새 정정 공고가 생길 때 늘어난다. */
const FROZEN = ['no', 'category', 'title', 'body', 'publishedAt', 'periodBasis', 'periodEndsOn', 'corrects'];

export class SyncError extends Error {}

async function getJson(fetchImpl, url) {
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new SyncError(`${url} — ${e}`);
  }
  if (res.status !== 200) throw new SyncError(`${url} — ${res.status}`);
  return res.json();
}

async function getBytes(fetchImpl, url) {
  let res;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(60_000) });
  } catch (e) {
    throw new SyncError(`${url} — ${e}`);
  }
  if (res.status !== 200) throw new SyncError(`${url} — ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** 첨부 파일 자리 — 게시 때 이름 그대로(새 탭에 그 이름이 보인다). 경로를 벗어나는 글자만 막는다. */
export function attachmentPath(no, name) {
  // GitHub Pages(Jekyll)는 . _ # 으로 시작하는 파일을 올리지 않는다 — 앞에 글자를 붙인다.
  const safe = name.replace(/[\\/]/g, '_').replace(/^[._#]/, 'f$&');
  return `notice/files/${no}/${safe}`;
}

export function noticeTitleTag(n) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  return `<title>제${n.no}호 ${esc(n.title)} — 공고 — Pivit</title>`;
}

/**
 * API 에서 읽어 쓸 파일 목록을 만든다. 쓰지는 않는다 — 검사가 다 통과한 뒤에만 쓰려고.
 * @returns {Promise<Map<string, Buffer|string>>} 저장소 루트 기준 경로 → 내용
 */
export async function plan({ api, root, fetchImpl = fetch }) {
  const apiOrigin = new URL(api).origin;
  const items = [];
  for (let page = 1; ; page++) {
    const body = await getJson(fetchImpl, `${api}?page=${page}`);
    items.push(...body.items);
    if (page >= body.totalPages) break;
  }

  const oldList = readJson(path.join(root, 'notice/data/list.json'))?.items ?? [];
  const newNos = new Set(items.map((i) => i.no));
  const dropped = oldList.filter((o) => !newNos.has(o.no)).map((o) => o.no);
  if (dropped.length) throw new SyncError(`사본에 있던 공고가 API 응답에서 빠졌습니다: 제${dropped.join('·')}호`);

  const out = new Map();
  const warnings = [];
  const template = fs.readFileSync(path.join(root, 'notice/index.html'), 'utf8');
  for (const item of items) {
    const d = await getJson(fetchImpl, `${api}/${item.no}`);
    const old = readJson(path.join(root, `notice/data/${item.no}.json`));
    if (old) {
      for (const k of FROZEN)
        if (JSON.stringify(old[k]) !== JSON.stringify(d[k]))
          throw new SyncError(`제${item.no}호의 ${k} 가 사본과 다릅니다 — 게시한 공고는 바뀌지 않아야 합니다`);
      if (old.attachment && (!d.attachment || old.attachment.name !== d.attachment.name || old.attachment.size !== d.attachment.size))
        throw new SyncError(`제${item.no}호의 첨부가 사본과 다릅니다`);
    }
    const copy = { ...d };
    if (d.attachment) {
      const rel = attachmentPath(d.no, d.attachment.name);
      copy.attachment = { name: d.attachment.name, size: d.attachment.size, url: '/' + rel.split('/').map(encodeURIComponent).join('/') };
      if (!fs.existsSync(path.join(root, rel))) {
        // 첨부 하나를 못 받아도 다른 공고는 올린다(정책 §8 E7 — 본문과 첨부는 따로 넘어진다). 빠진 첨부는 다음 회차에 다시 받는다.
        try {
          const bytes = await getBytes(fetchImpl, new URL(d.attachment.url, apiOrigin).href);
          if (bytes.length !== d.attachment.size)
            throw new SyncError(`크기가 다릅니다(${bytes.length} ≠ ${d.attachment.size})`);
          out.set(rel, bytes);
        } catch (e) {
          warnings.push(`제${d.no}호 첨부를 받지 못했습니다 — ${e.message}`);
        }
      }
    }
    out.set(`notice/data/${d.no}.json`, JSON.stringify(copy, null, 1) + '\n');
    out.set(`notice/${d.no}/index.html`, template.replace(/<title>[^<]*<\/title>/, () => noticeTitleTag(d)));
  }
  out.set('notice/data/list.json', JSON.stringify({ items }, null, 1) + '\n');
  out.warnings = warnings;
  return out;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

/** 바뀐 파일만 쓴다. 쓴 경로를 돌려준다. */
export function write(root, files) {
  const changed = [];
  for (const [rel, content] of files) {
    const full = path.join(root, rel);
    const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
    if (fs.existsSync(full) && fs.readFileSync(full).equals(buf)) continue;
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, buf);
    changed.push(rel);
  }
  return changed;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const api = (process.env.NOTICE_API || 'https://app.pivit.work/api/public/notices').replace(/\/+$/, '');
  try {
    const files = await plan({ api, root });
    for (const w of files.warnings) console.log(`::warning::${w}`);
    const changed = write(root, files);
    console.log(changed.length ? `바뀐 파일 ${changed.length}개:\n${changed.join('\n')}` : '바뀐 것 없음');
  } catch (e) {
    console.error(`공고 동기화 실패 — 사본은 그대로 둡니다: ${e.message}`);
    process.exit(1);
  }
}
