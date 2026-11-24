// Update store for installed Loopy Office apps: serves win/latest.yml and the Windows installers
// from the R2 bucket bound as BUCKET, but only to requests that carry the read key
// (X-Loopy-Key, the READ_KEY secret). Anything else gets a plain 404, so the address alone shows nothing.
// Uploads don't go through here: CI writes to the bucket with its own bucket-scoped token.
const NAME = /^win\/[A-Za-z0-9][A-Za-z0-9._-]*\.(yml|exe|blockmap)$/;
const TYPES = { yml: 'text/yaml; charset=utf-8', exe: 'application/octet-stream', blockmap: 'application/octet-stream' };
const notFound = () => new Response('Not found', { status: 404 });

function sameKey(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405 });
    if (!env.READ_KEY || !sameKey(request.headers.get('x-loopy-key'), env.READ_KEY)) return notFound();
    if (!env.BUCKET) return notFound(); // deployed before the bucket exists: nothing to serve yet
    const key = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''));
    const match = NAME.exec(key);
    if (!match) return notFound();
    const object = request.method === 'HEAD'
      ? await env.BUCKET.head(key)
      : await env.BUCKET.get(key, { range: request.headers, onlyIf: request.headers });
    if (!object) return notFound();
    const headers = new Headers({
      'content-type': TYPES[match[1]],
      'etag': object.httpEtag,
      'accept-ranges': 'bytes',
      // latest.yml changes with each release; installers never change under the same name
      'cache-control': match[1] === 'yml' ? 'no-store' : 'private, max-age=86400',
    });
    if (request.method === 'HEAD') {
      headers.set('content-length', String(object.size));
      return new Response(null, { headers });
    }
    if (!('body' in object)) return new Response(null, { status: 304, headers });
    if (object.range && request.headers.has('range')) {
      const start = object.range.offset ?? 0;
      const length = object.range.length ?? object.size - start;
      headers.set('content-range', `bytes ${start}-${start + length - 1}/${object.size}`);
      headers.set('content-length', String(length));
      return new Response(object.body, { status: 206, headers });
    }
    headers.set('content-length', String(object.size));
    return new Response(object.body, { headers });
  },
};
