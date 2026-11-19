/**
 * Cloudflare Worker — CORS Proxy for PlayTelas HLS Streams (.m3u8) & Video Segments
 *
 * Deploy instructions (Cloudflare Free Plan — 100,000 requests/day):
 * 1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create Worker
 * 2. Paste this file and click "Deploy"
 * 3. Copy the Worker URL (e.g. https://playtelas-proxy.your-subdomain.workers.dev)
 * 4. Configure VITE_HLS_PROXY_URL or paste the URL into the PlayTelas player prompt.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type',
  'Access-Control-Max-Age': '86400',
};

function isPlaylistUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    const path = u.pathname.toLowerCase();
    return path.endsWith('.m3u8') || path.endsWith('.m3u') || u.search.toLowerCase().includes('.m3u8');
  } catch {
    return urlStr.toLowerCase().includes('.m3u8');
  }
}

function rewriteUrl(rawUrl, baseUrl, workerOrigin, customRef) {
  const resolved = new URL(rawUrl, baseUrl).href;
  const refSuffix = customRef ? `&ref=${encodeURIComponent(customRef)}` : '';
  return `${workerOrigin}/?url=${encodeURIComponent(resolved)}${refSuffix}`;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    const reqUrl = new URL(request.url);
    const targetUrl = reqUrl.searchParams.get('url');
    const customRef = reqUrl.searchParams.get('ref');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'PlayTelas HLS & Segment CORS Proxy' }),
        {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/json; charset=utf-8',
          },
        }
      );
    }

    let parsedTarget;
    try {
      parsedTarget = new URL(targetUrl);
      if (parsedTarget.protocol !== 'http:' && parsedTarget.protocol !== 'https:') {
        throw new Error('Invalid protocol');
      }
    } catch {
      return new Response('Invalid target URL', { status: 400, headers: CORS_HEADERS });
    }

    try {
      const upstreamHeaders = {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, */*',
      };
      if (customRef) {
        upstreamHeaders['Referer'] = customRef;
      }
      const rangeHeader = request.headers.get('Range');
      if (rangeHeader) {
        upstreamHeaders['Range'] = rangeHeader;
      }

      const upstream = await fetch(parsedTarget.href, {
        method: request.method,
        redirect: 'follow',
        headers: upstreamHeaders,
      });

      const finalUrl = upstream.url || parsedTarget.href;
      const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
      const looksLikeM3u8 =
        isPlaylistUrl(finalUrl) ||
        contentType.includes('mpegurl') ||
        contentType.includes('m3u8');

      if (!upstream.ok) {
        return new Response(`Upstream error: ${upstream.status}`, {
          status: upstream.status,
          headers: CORS_HEADERS,
        });
      }

      if (looksLikeM3u8 && request.method !== 'HEAD') {
        const text = await upstream.text();
        const workerOrigin = reqUrl.origin;

        const rewritten = text
          .split(/\r?\n/)
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;

            if (trimmed.startsWith('#')) {
              return line.replace(/URI="([^"]+)"/gi, (_, uri) => {
                try {
                  return `URI="${rewriteUrl(uri, finalUrl, workerOrigin, customRef)}"`;
                } catch {
                  return `URI="${uri}"`;
                }
              });
            }

            try {
              return rewriteUrl(trimmed, finalUrl, workerOrigin, customRef);
            } catch {
              return line;
            }
          })
          .join('\n');

        return new Response(rewritten, {
          status: 200,
          headers: {
            ...CORS_HEADERS,
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate',
          },
        });
      }

      const headers = new Headers(CORS_HEADERS);
      if (contentType) headers.set('Content-Type', contentType);
      for (const h of ['cache-control', 'content-length', 'content-range', 'accept-ranges']) {
        const val = upstream.headers.get(h);
        if (val) headers.set(h, val);
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers,
      });
    } catch (err) {
      return new Response(`Proxy fetch error: ${err?.message || 'unknown'}`, {
        status: 502,
        headers: CORS_HEADERS,
      });
    }
  },
};
