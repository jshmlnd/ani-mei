import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'dist');
const port = Number(process.env.PORT) || 3000;
const types = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

createServer((req, res) => {
  if (!req.url || !['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }

  const requested = normalize(new URL(req.url, 'http://localhost').pathname);
  const relative = requested === '/' ? 'index.html' : requested.slice(1);
  const file = join(root, relative);
  const resolved = file.startsWith(root) ? file : join(root, 'index.html');
  const target = existsSync(resolved) && statSync(resolved).isFile()
    ? resolved
    : join(root, 'index.html');

  res.writeHead(200, {
    'Content-Type': types[extname(target)] || 'application/octet-stream',
    'Cache-Control': target.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  });

  if (req.method === 'HEAD') {
    res.end();
  } else {
    createReadStream(target).pipe(res);
  }
}).listen(port, '0.0.0.0', () => {
  console.log(`Animei listening on port ${port}`);
});
