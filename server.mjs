import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 5173);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    const requestedPath = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const filePath = resolve(root, `.${requestedPath}`);

    if (!filePath.startsWith(`${root}/`) && filePath !== root) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, { 'Content-Type': mimeTypes[extname(filePath)] || 'application/octet-stream' });
    response.end(body);
  } catch {
    const url = new URL(request.url || '/', `http://${request.headers.host}`);

    if (url.pathname === '/config.js') {
      response.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8' });
      response.end(`window.SMART_MAP_GOOGLE_MAPS_API_KEY = window.SMART_MAP_GOOGLE_MAPS_API_KEY || '${escapeJavaScript(process.env.GOOGLE_MAPS_API_KEY || '')}';\n`);
      return;
    }

    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
  }
}).listen(port, () => {
  console.log(`Smart Map Platform is running at http://localhost:${port}`);
});

function escapeJavaScript(value) {
  return String(value).replace(/[\\']/g, (character) => `\\${character}`);
}
