/**
 * Cloudflare Worker — Proxy CORS leve para manifestos HLS (.m3u8) do PlayTelas
 *
 * Como usar gratuitamente (100.000 requisições/dia grátis):
 * 1. Acesse https://dash.cloudflare.com -> Workers & Pages -> Create Worker
 * 2. Cole este código e clique em "Deploy"
 * 3. Copie a URL gerada (ex: https://playtelas-proxy.seu-subdominio.workers.dev)
 * 4. Configure VITE_HLS_PROXY_URL no build ou cole a URL diretamente no aviso do player.
 *
 * Este worker faz proxy APENAS dos arquivos .m3u8 (leves, poucos KB).
 * Os segmentos de vídeo (.ts) e chaves (.key) continuam carregando direto da CDN.
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Max-Age': '86400',
};

function isPlaylistUrl(urlStr) {
  try {
    const u = new URL(urlStr);
    return u.pathname.toLowerCase().endsWith('.m3u8') || u.search.toLowerCase().includes('.m3u8');
  } catch {
    return urlStr.toLowerCase().includes('.m3u8');
  }
}

function rewriteUrl(rawUrl, baseUrl, workerOrigin) {
  const resolved = new URL(rawUrl, baseUrl).href;
  if (isPlaylistUrl(resolved)) {
    return `${workerOrigin}/?url=${encodeURIComponent(resolved)}`;
  }
  return resolved;
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const reqUrl = new URL(request.url);
    const targetUrl = reqUrl.searchParams.get('url');

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ status: 'ok', service: 'PlayTelas HLS CORS Proxy' }),
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
        throw new Error('Protocolo inválido');
      }
    } catch {
      return new Response('URL inválida', { status: 400, headers: CORS_HEADERS });
    }

    try {
      const upstream = await fetch(parsedTarget.href, {
        method: request.method === 'HEAD' ? 'HEAD' : 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'application/vnd.apple.mpegurl, application/x-mpegurl, */*',
        },
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
                  return `URI="${rewriteUrl(uri, finalUrl, workerOrigin)}"`;
                } catch {
                  return `URI="${uri}"`;
                }
              });
            }

            try {
              return rewriteUrl(trimmed, finalUrl, workerOrigin);
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
      const cacheControl = upstream.headers.get('cache-control');
      if (cacheControl) headers.set('Cache-Control', cacheControl);

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
