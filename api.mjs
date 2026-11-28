import { catalog, demo, parseSections, canPlay, getWords, sectionSeconds, sectionsInScope, createRoom, joinRoom, act, roomView, fail } from './game.mjs';

const ids = new Map(catalog.flatMap(([, entries]) => entries));
const lawScopes = new Map(catalog.flatMap(([, entries]) => entries.flatMap(([book, title, division]) =>
  (division?.scopes ?? []).map(scope => [scope.id, { ...scope, book, bookTitle: title }]))));
const roomLife = 4 * 60 * 60 * 1000;
export const maxText = 500000;
const maxPayload = 2_000_000;

function response(data, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}

function parsePlayable(raw, limit = maxText) {
  if (typeof raw !== 'string' || raw.length > limit) {
    fail('ข้อความยาวเกิน ' + limit.toLocaleString('en-US') + ' ตัวอักษร');
  }
  const sections = parseSections(raw);
  if (sections.length > 1500) fail('บันทึกได้สูงสุด 1,500 มาตราต่อชุด');
  return sections;
}

async function authenticate(request, password) {
  if (!password) fail('ยังไม่ได้ตั้งรหัสผ่านผู้ดูแล', 503);
  const sent = request.headers.get('X-Admin-Password') ?? '';
  if (sent.length > 256) fail('รหัสผ่านไม่ถูกต้อง', 401);
  const encoder = new TextEncoder();
  const [left, right] = await Promise.all([sent, password].map(async value =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))),
  ));
  let difference = 0;
  for (let index = 0; index < left.length; index++) difference |= left[index] ^ right[index];
  if (difference) fail('รหัสผ่านไม่ถูกต้อง', 401);
}

async function readJSON(request) {
  if (!request.headers.get('content-type')?.includes('application/json')) fail('รูปแบบข้อมูลไม่ถูกต้อง', 415);
  if (Number(request.headers.get('content-length')) > maxPayload) fail('ข้อมูลใหญ่เกินกำหนด', 413);
  if (!request.body) fail('กรุณาส่งข้อมูล');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let raw = '';
  let length = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if ((length += value.length) > maxPayload) {
      await reader.cancel();
      fail('ข้อมูลใหญ่เกินกำหนด', 413);
    }
    raw += decoder.decode(value, { stream: true });
  }
  try {
    const parsed = JSON.parse(raw + decoder.decode());
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {}
  fail('รูปแบบข้อมูลไม่ถูกต้อง');
}

async function changeRoom(store, key, callback) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const row = await store.read(key);
    if (!row) fail('ไม่พบห้องนี้ หรือห้องหมดอายุแล้ว', 404);
    const result = callback(row.value);
    if (await store.swap(key, row.rev, row.value, Date.now() + roomLife)) return result;
  }
  fail('มีหลายคนทำรายการพร้อมกัน กรุณาลองใหม่', 409);
}

export async function handleAPI(request, store, password) {
  const { pathname } = new URL(request.url);
  const method = request.method;
  const token = request.headers.get('X-Player-Token');
  try {
    if (pathname === '/api/catalog' && method === 'GET') {
      const contents = new Map(await store.contentSummary());
      return response(await Promise.all(catalog.map(async ([label, entries]) => ({
        label, entries: await Promise.all(entries.map(async ([id, title, division]) => {
          const count = contents.get(id) ?? 0;
          const scopes = division?.scopes;
          if (!scopes) return { id, title, ...division, count };
          const sections = count ? (await store.read('content:' + id))?.value.sections ?? [] : [];
          return { id, title, ...division, count, scopes: scopes.map(scope => {
            const scoped = sectionsInScope(sections, scope);
            return { ...scope, count: scoped.length, questionCount: scoped.length };
          }) };
        })),
      }))));
    }
    if (pathname === '/api/admin' && method === 'GET') {
      await authenticate(request, password);
      return response({ ok: true });
    }
    const contentRoute = pathname.match(/^\/api\/admin\/([a-z-]+)$/u);
    if (contentRoute && ids.has(contentRoute[1])) {
      await authenticate(request, password);
      const key = 'content:' + contentRoute[1];
      if (method === 'GET') return response({ raw: (await store.read(key))?.value.raw ?? '' });
      if (method === 'DELETE') {
        await store.remove(key);
        return response({ ok: true });
      }
      if (method === 'PUT' || method === 'POST') {
        const data = await readJSON(request);
        const sections = parsePlayable(data.raw);
        const invalid = sections.flatMap((section, index) => canPlay(section) ? [] : [index]);
        if (method === 'PUT') {
          if (!sections.length) fail('กรุณาใส่ข้อความตัวบท');
          if (invalid.length) fail('แต่ละมาตราต้องมีคำต่างกันอย่างน้อย 4 คำ');
          await store.save(key, { raw: data.raw, sections });
        }
        return response({ sections: sections.map(section => ({ ...section, effectiveSeconds: sectionSeconds(section) })), invalid });
      }
    }
    if (pathname === '/api/rooms' && method === 'POST') {
      const data = await readJSON(request);
      const scope = lawScopes.get(data.source);
      let sections;
      let title;
      if (data.source === 'sample') {
        sections = demo;
        title = 'ชุดตัวอย่าง';
      } else if (data.source === 'paste') {
        sections = parsePlayable(data.raw, 150000);
        title = 'ข้อความที่วางเอง';
      } else if (scope) {
        title = scope.bookTitle + ' · ' + scope.label;
        const book = (await store.read('content:' + scope.book))?.value.sections ?? [];
        sections = sectionsInScope(book, scope).map(section => {
          if (section.keywords?.length || section.keyword) return section;
          const words = getWords(section.text);
          return { ...section, keyword: words.find(item => [...item.word].length >= 3) ?? words[0] };
        });
        if (!sections.length) fail('ลักษณะนี้ยังรอใส่เนื้อหา');
      } else if (ids.has(data.source)) {
        title = ids.get(data.source);
        sections = (await store.read('content:' + data.source))?.value.sections;
        if (!sections) fail('ตัวบทนี้ยังรอใส่เนื้อหา');
      } else {
        fail('กรุณาเลือกชุดตัวบท');
      }
      const room = createRoom({ title, sections, names: data.names, count: data.count,
        manual: !scope && data.manual, mode: scope ? 'type' : data.mode });
      await store.sweep();
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = crypto.randomUUID().replace(/-/gu, '').slice(0, 20);
        if (await store.insert('room:' + code, room, Date.now() + roomLife)) {
          return response({ code, token: room.players[0].token, state: roomView(room, room.players[0].token) }, 201);
        }
      }
      fail('เปิดห้องไม่สำเร็จ กรุณาลองใหม่', 503);
    }
    const roomRoute = pathname.match(/^\/api\/rooms\/([a-f0-9]{20})(?:\/(join|act))?$/u);
    if (roomRoute) {
      const [, code, verb] = roomRoute;
      const key = 'room:' + code;
      if (method === 'GET' && !verb) {
        const row = await store.read(key);
        if (!row) fail('ไม่พบห้องนี้ หรือห้องหมดอายุแล้ว', 404);
        return response(roomView(row.value, token));
      }
      if (method === 'POST' && verb) {
        const data = await readJSON(request);
        const receivedAt = Date.now();
        const result = await changeRoom(store, key, room => {
          if (verb === 'join') {
            const joined = joinRoom(room, data);
            return { token: joined, state: roomView(room, joined) };
          }
          act(room, token, data, data.action === 'answer' ? receivedAt : Date.now());
          return { state: roomView(room, token) };
        });
        return response(result);
      }
    }
    return response({ error: 'ไม่พบหน้านี้' }, 404);
  } catch (error) {
    if (!error.status) console.error(error);
    return response({ error: error.status ? error.message : 'ระบบขัดข้อง กรุณาลองใหม่' }, error.status ?? 500);
  }
}

export function cloudStore(db) {
  const run = (sql, ...args) => db.prepare(sql).bind(...args).run();
  return {
    async read(key) {
      const row = await db.prepare('SELECT value, rev FROM game_state WHERE key = ? AND (expires IS NULL OR expires > ?)').bind(key, Date.now()).first();
      return row && { value: JSON.parse(row.value), rev: row.rev };
    },
    async insert(key, data, expires) {
      const result = await run('INSERT OR IGNORE INTO game_state (key, value, expires) VALUES (?, ?, ?)', key, JSON.stringify(data), expires);
      return result.meta.changes === 1;
    },
    async swap(key, rev, data, expires) {
      const result = await run('UPDATE game_state SET value = ?, rev = rev + 1, expires = ? WHERE key = ? AND rev = ? AND expires > ?', JSON.stringify(data), expires, key, rev, Date.now());
      return result.meta.changes === 1;
    },
    async save(key, data) {
      await run('INSERT INTO game_state (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, JSON.stringify(data));
    },
    async remove(key) {
      await run('DELETE FROM game_state WHERE key = ?', key);
    },
    async sweep() {
      await run('DELETE FROM game_state WHERE expires <= ?', Date.now());
    },
    async contentSummary() {
      const { results } = await db.prepare("SELECT substr(key, 9) AS id, json_array_length(value, '$.sections') AS count FROM game_state WHERE key LIKE 'content:%'").all();
      return results.map(row => [row.id, row.count]);
    },
  };
}
