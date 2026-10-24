// Bind ASSETS to the directory containing the builder's output. No URL proxy.
export default {
  async fetch(request, env) {
    if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405 });
    if (!env.ASSETS?.fetch) return new Response('Built document asset binding unavailable', { status: 503 });
    return env.ASSETS.fetch(request);
  },
};

// Keep optional Node adapter imports opaque to Worker bundlers; no Node module
// is required or evaluated by the Worker handler.
const nodeImport = specifier => import(specifier);

// Local HTTP serves exactly one already-built file; never opens a window.
export async function serveBuiltHTML(path, port = 8788) {
  const { readFile } = await nodeImport('node:fs/promises');
  const { createServer } = await nodeImport('node:http');
  const html = await readFile(path);
  const server = createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    if (req.url !== '/' && req.url !== '/index.html') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' });
    res.end(req.method === 'HEAD' ? undefined : html);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(Number(port), '127.0.0.1', resolve); });
  return server;
}

if (typeof process !== 'undefined' && process.argv?.[1] && import.meta.url === (await nodeImport('node:url')).pathToFileURL(process.argv[1]).href) {
  const [path, port = '8788'] = process.argv.slice(2);
  if (!path) throw new Error('Usage: node demo/markdoc-ragbaz/worker.mjs built.html [port]');
  const server = await serveBuiltHTML(path, port);
  console.log(`Built document at http://127.0.0.1:${server.address().port}/`);
}
