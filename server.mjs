import { siteAssets } from './assets.mjs';
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { handleAPI } from './api.mjs';
import { canPlay, parseSections } from './game.mjs';

const rooms = new Map();
const channels = new Map();
const contentDir = new URL('./data/content/', import.meta.url);
const contentFile = key => new URL(key.slice('content:'.length) + '.json', contentDir);
const password = process.env.ADMIN_PASSWORD;
const routeRoom = /^\/live\/([a-f0-9]{20})$/u;
function broadcast(key) {
  const message = Buffer.from([0x81, 0x01, 0x31]);
  for (const socket of channels.get(key) ?? []) {
    if (socket.writableLength < 8192) socket.write(message);
    else socket.destroy();
  }
}

const store = {
  async read(key) {
    if (key.startsWith('room:')) {
      const row = rooms.get(key);
      return row && row.expires > Date.now() ? structuredClone(row) : null;
    }
    try {
      return { value: JSON.parse(await readFile(contentFile(key), 'utf8')) };
    } catch (err) {
      if (err.code === 'ENOENT') return null;
      throw err;
    }
  },
  async insert(key, value, expires) {
    if (rooms.has(key)) return false;
    rooms.set(key, { value, rev: 0, expires });
    return true;
  },
  async swap(key, rev, value, expires) {
    const row = rooms.get(key);
    if (!row || row.rev !== rev || row.expires <= Date.now()) return false;
    rooms.set(key, { value, rev: rev + 1, expires });
    broadcast(key);
    return true;
  },
  async save(key, value) {
    await mkdir(contentDir, { recursive: true });
    const temporary = new URL(randomUUID() + '.tmp', contentDir);
    try {
      await writeFile(temporary, JSON.stringify(value, null, 2), 'utf8');
      await rename(temporary, contentFile(key));
    } finally {
      await rm(temporary, { force: true });
    }
  },
  async remove(key) {
    await rm(contentFile(key), { force: true });
  },
  async sweep() {
    const now = Date.now();
    for (const [key, row] of rooms) {
      if (row.expires > now) continue;
      rooms.delete(key);
      broadcast(key);
      for (const socket of channels.get(key) ?? []) socket.end(Buffer.from([0x88, 0x00]));
    }
  },
  async contentSummary() {
    let files;
    try {
      files = await readdir(contentDir);
    } catch (err) {
      if (err.code === 'ENOENT') return [];
      throw err;
    }
    return (await Promise.all(files.filter(file => /^[a-z-]+\.json$/u.test(file)).map(async file => {
      const id = file.slice(0, -5);
      const row = await store.read('content:' + id);
      return [id, row?.value.sections.length ?? 0];
    })));
  },
};

const security = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'self'; form-action 'self'; base-uri 'none'",
};

async function installBundledContent() {
  const seedDir = new URL('./data/seed/', import.meta.url);
  const sources = await readdir(seedDir).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  if (!sources.length) return;
  await mkdir(contentDir, { recursive: true });
  for (const name of sources.filter(name => /^[a-z-]+\.txt$/u.test(name))) {
    const raw = await readFile(new URL(name, seedDir), 'utf8');
    const sections = parseSections(raw);
    if (!sections.length || !sections.every(canPlay)) throw new Error('Invalid bundled content: ' + name);
    const key = 'content:' + name.slice(0, -4);
    try {
      await writeFile(contentFile(key), JSON.stringify({ raw, sections }), { flag: 'wx', encoding: 'utf8' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    console.log('Bundled set ready: ' + key.slice(8) + ' (' + sections.length + ' sections)');
  }
}

await installBundledContent();

const server = createServer(async (incoming, outgoing) => {
  try {
    const path = new URL(incoming.url, 'http://localhost').pathname;
    if (path.startsWith('/api/')) {
      const hasBody = !['GET', 'HEAD'].includes(incoming.method);
      const request = new Request('http://localhost' + incoming.url, {
        method: incoming.method,
        headers: incoming.headers,
        ...(hasBody && { body: Readable.toWeb(incoming), duplex: 'half' }),
      });
      const result = await handleAPI(request, store, password);
      outgoing.writeHead(result.status, { ...security, ...Object.fromEntries(result.headers) });
      outgoing.end(Buffer.from(await result.arrayBuffer()));
    } else if (siteAssets.has(path) || path === '/' || path === '/admin' || /^\/r\/[a-f0-9]{20}$/u.test(path)) {
      const [mime, body] = siteAssets.get(path) ?? siteAssets.get('/');
      outgoing.writeHead(200, { ...security, 'Content-Type': mime + '; charset=utf-8' });
      outgoing.end(body);
    } else {
      outgoing.writeHead(404, { ...security, 'Content-Type': 'text/plain; charset=utf-8' });
      outgoing.end('ไม่พบหน้านี้');
    }
  } catch (err) {
    console.error(err);
    if (!outgoing.headersSent) outgoing.writeHead(500);
    outgoing.end();
  }
});

// Room changes are sent as one-way notifications. Game actions use the HTTP API.
server.on('upgrade', (request, socket) => {
  socket.on('error', () => socket.destroy());
  const code = request.url.match(routeRoom)?.[1];
  const key = 'room:' + code;
  const websocketKey = request.headers['sec-websocket-key'];
  let set = channels.get(key);
  if (request.method !== 'GET' || request.headers.upgrade?.toLowerCase() !== 'websocket' ||
      request.headers['sec-websocket-version'] !== '13' ||
      !/^[A-Za-z0-9+/]{22}==$/u.test(websocketKey ?? '') || !rooms.has(key) || set?.size >= 40) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return;
  }
  const accept = createHash('sha1').update(websocketKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  socket.setNoDelay(true);
  if (!set) channels.set(key, set = new Set());
  set.add(socket);
  socket.once('data', () => socket.end(Buffer.from([0x88, 0x00])));
  socket.on('close', () => {
    set.delete(socket);
    if (!set.size) channels.delete(key);
  });
});

setInterval(() => store.sweep(), 60000).unref();
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? (process.env.RENDER === 'true' ? '0.0.0.0' : '127.0.0.1');
server.listen(port, host, () => {
  console.log('เติมมาตรา · http://' + host + ':' + server.address().port);
  if (!password) console.log('ตั้ง ADMIN_PASSWORD เพื่อเปิดหน้าใส่ตัวบท');
});

export { server };
