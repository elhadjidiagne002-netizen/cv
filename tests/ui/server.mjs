// Petit serveur statique de développement (aucune dépendance) : sert public/ avec les en-têtes
// de sécurité de public/_headers (bloc « /* »), pour tester l'application sous sa vraie CSP.
// Usage : node tests/ui/server.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (path.endsWith('/')) path += 'index.html';
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
