// Petit serveur statique de développement (aucune dépendance) : sert public/ avec les en-têtes
// de sécurité de public/_headers (bloc « /* »), pour tester l'application sous sa vraie CSP.
// Les appels /api/* sont traités par les fonctions Cloudflare (functions/_lib/api.js) sur une base D1 imitée
// (node:sqlite, en mémoire) et une fausse base « Devizo » : compte admin@nexusmarket.sn / Mot-de-passe-1,
// application d'authentification de secret TEST_TOTP_SECRET. Chaque valeur du cookie « testdb » a sa propre
// base (tests en parallèle isolés) ; sans ce cookie, base commune avec la monétisation désactivée.
// Usage : node tests/ui/server.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { handle } from '../../functions/_lib/api.js';
import { hashPassword } from '../../functions/_lib/devizo.js';
import { createD1, DEVIZO_SCHEMA } from '../helpers/d1.js';

export const TEST_TOTP_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const envs = new Map();

async function envFor(name) {
  if (!envs.has(name)) {
    envs.set(name, (async () => {
      const AUTH_DB = createD1(DEVIZO_SCHEMA);
      await AUTH_DB.prepare('INSERT INTO tenants (id, email, password_hash) VALUES (?, ?, ?)').bind('t1', 'admin@nexusmarket.sn', await hashPassword('Mot-de-passe-1', 1000)).run();
      await AUTH_DB.prepare('INSERT INTO totp_secrets (owner_key, secret, enabled) VALUES (?, ?, 1)').bind('t:t1', TEST_TOTP_SECRET).run();
      return { DB: createD1(), AUTH_DB, ADMIN_EMAILS: 'admin@nexusmarket.sn' };
    })());
  }
  return envs.get(name);
}

async function api(req, res) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) headers.set(k, Array.isArray(v) ? v.join(', ') : v);
  const url = `http://${req.headers.host}${req.url}`;
  const init = { method: req.method, headers };
  if (!['GET', 'HEAD'].includes(req.method)) init.body = Buffer.concat(chunks);
  const db = (/(?:^|;\s*)testdb=([\w-]+)/.exec(req.headers.cookie || '') || [])[1] || 'default';
  const out = await handle(new Request(url, init), await envFor(db));
  const outHeaders = {};
  out.headers.forEach((v, k) => { if (k !== 'set-cookie') outHeaders[k] = v; });
  const cookies = out.headers.getSetCookie();
  if (cookies.length) outHeaders['set-cookie'] = cookies;
  res.writeHead(out.status, outHeaders);
  res.end(Buffer.from(await out.arrayBuffer()));
}

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public');
const port = Number(process.argv[2] || process.env.PORT || 5610);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
};

/** En-têtes du bloc « /* » de _headers (format Cloudflare Pages). */
function globalHeaders() {
  const lines = readFileSync(join(root, '_headers'), 'utf8').split(/\r?\n/);
  const headers = {};
  let inGlobal = false;
  for (const line of lines) {
    if (!line.trim()) continue;
    if (!/^\s/.test(line)) {
      inGlobal = line.trim() === '/*';
      continue;
    }
    if (inGlobal) {
      const i = line.indexOf(':');
      const name = line.slice(0, i).trim();
      if (name !== 'Strict-Transport-Security') headers[name] = line.slice(i + 1).trim().replace(/;\s*upgrade-insecure-requests/, '');
    }
  }
  return headers;
}

const headers = globalHeaders();

createServer(async (req, res) => {
  if (req.url.startsWith('/api/')) {
    api(req, res).catch((err) => {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(String(err));
    });
    return;
  }
  try {
    const u = new URL(req.url, 'http://x');
    // Comme Cloudflare Pages : « /x.html » → 308 vers « /x », et « /x » sert x.html. Sans cela, un service worker
    // qui ressert une réponse redirigée à une navigation (ERR_FAILED en production) passerait inaperçu.
    if (u.pathname.endsWith('.html')) {
      res.writeHead(308, { Location: (u.pathname.replace(/(index)?\.html$/, '') || '/') + u.search });
      res.end();
      return;
    }
    let path = decodeURIComponent(u.pathname);
    if (path.endsWith('/')) path += 'index.html';
    else if (!extname(path)) path += '.html';
    const file = normalize(join(root, path));
    if (!file.startsWith(root)) throw new Error('interdit');
    const body = await readFile(file);
    res.writeHead(200, { ...headers, 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Introuvable');
  }
}).listen(port, () => console.log(`Serveur de test : http://localhost:${port}/`));
