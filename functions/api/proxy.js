export async function onRequest(context) {
  const { request } = context;
  const reqUrl = new URL(request.url);
  const url = reqUrl.searchParams.get('url');
  const h = reqUrl.searchParams.get('h');
  const raw = reqUrl.searchParams.get('raw');

  if (!url) {
    return new Response(JSON.stringify({ error: 'Missing url parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const targetUrl = decodeURIComponent(url);
  const headers = h ? JSON.parse(decodeURIComponent(h)) : {};

  try {
    // Determine the correct Referer/Origin based on the target domain
    let referer = headers.Referer;
    let origin = headers.Origin;
    let isApiDomain = false;
    let isEmbedDomain = false;
    
    try {
      const parsedTarget = new URL(targetUrl);
      const hostname = parsedTarget.hostname;
      
      // Check if it's a known API domain (allow JSON responses)
      if (hostname.includes('animeiapi.joshuaklein-malonda.workers.dev') ||
          hostname.includes('anikototv') ||
          hostname.includes('anilist.co')) {
        isApiDomain = true;
      }
      
      // Check if it's a known embed domain (allow HTML responses)
      if (hostname.includes('echovideo') ||
          hostname.includes('megavid') ||
          hostname.includes('buzz') ||
          hostname.includes('myvidplay') ||
          hostname.includes('kryntal') ||
          hostname.includes('gn1r5n') ||
          hostname.includes('play.echovideo') ||
          hostname.includes('vidplay') ||
          hostname.includes('stream') ||
          hostname.includes('embed')) {
        isEmbedDomain = true;
      }
      
      if (!referer || !origin) {
        if (hostname.includes('kryntal.top')) {
          referer = referer || 'https://www.aniwaves.ru/';
          origin = origin || 'https://www.aniwaves.ru';
        } else if (hostname.includes('megavid') || hostname.includes('buzz')) {
          referer = referer || 'https://megavid.buzz/';
          origin = origin || 'https://megavid.buzz';
        } else if (hostname.includes('myvidplay')) {
          referer = referer || 'https://aniwaves.ru/';
          origin = origin || 'https://aniwaves.ru';
        } else if (hostname.includes('echovideo')) {
          referer = referer || 'https://aniwaves.ru/';
          origin = origin || 'https://aniwaves.ru';
        } else if (hostname.includes('gn1r5n')) {
          referer = referer || 'https://gn1r5n.org/';
          origin = origin || 'https://gn1r5n.org';
        } else {
          referer = referer || `${parsedTarget.origin}/`;
          origin = origin || parsedTarget.origin;
        }
      }
    } catch {
      referer = referer || 'https://megavid.buzz/';
      origin = origin || 'https://megavid.buzz';
    }

    const fetchHeaders = {
      'Referer': referer,
      'Origin': origin,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (headers.Range) fetchHeaders['Range'] = headers.Range;
    if (headers['Accept-Ranges']) fetchHeaders['Accept-Ranges'] = headers['Accept-Ranges'];
    if (headers.Accept) fetchHeaders['Accept'] = headers.Accept;

    // Add timeout for upstream requests (25 seconds to stay within Vercel 30s limit)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    
    let upstream;
    try {
      upstream = await fetch(targetUrl, { 
        headers: fetchHeaders,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    // If 403, retry with alternative headers (CDN may require specific referer)
    if (upstream.status === 403) {
      try {
        const parsedTarget = new URL(targetUrl);
        const altReferers = [
          `${parsedTarget.origin}/`,
          'https://www.google.com/',
          'https://aniwaves.ru/',
          'https://megavid.buzz/',
          'https://gn1r5n.org/',
        ].filter((r) => r !== referer);

        for (const altRef of altReferers) {
          const altHeaders = { ...fetchHeaders, Referer: altRef, Origin: parsedTarget.origin };
          const altController = new AbortController();
          const altTimeoutId = setTimeout(() => altController.abort(), 10000);
          try {
            const altUpstream = await fetch(targetUrl, { 
              headers: altHeaders,
              signal: altController.signal,
            });
            if (altUpstream.ok) {
              upstream = altUpstream;
              break;
            }
          } finally {
            clearTimeout(altTimeoutId);
          }
        }
      } catch {
        // ignore retry errors, fall through with original 403
      }
    }

    if (!upstream.ok) {
      return new Response(JSON.stringify({
        error: `Upstream returned ${upstream.status}`,
        url: targetUrl,
      }), {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    const contentLength = upstream.headers.get('content-length');

    if (raw === '1') {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': contentType || 'application/octet-stream',
          'Cache-Control': 'no-store',
        },
      });
    }

    const isLikelyM3u8 = contentType.includes('mpegurl') || contentType.includes('m3u8')
      || /\.m3u8($|\?)/i.test(targetUrl)
      || contentType.includes('image/jpeg');

    if (isLikelyM3u8) {
      const body = await upstream.text();
      const firstChars = body.trimStart().slice(0, 10);
      if (firstChars.startsWith('#EXTM3U')) {
        const origin = reqUrl.origin;
        const proxyBase = `${origin}/api/proxy`;
        const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
        const rewritten = rewriteM3U8(body, targetUrl, proxyBase, encodedHeaders);

        return new Response(rewritten, {
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=2',
          },
        });
      }
      if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain')) {
        return new Response(JSON.stringify({
          error: 'M3U8 URL returned non-video content',
          contentType,
          url: targetUrl,
        }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response(JSON.stringify({
        error: 'M3U8 URL returned non-M3U8 content',
        contentType,
        url: targetUrl,
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Allow JSON responses for API domains
    if (isApiDomain && contentType.includes('application/json')) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': contentType || 'application/json',
          'Cache-Control': 'no-store',
        },
      });
    }

    // Allow HTML responses for embed domains (for parsing)
    if (isEmbedDomain && contentType.includes('text/html')) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': contentType || 'text/html',
          'Cache-Control': 'no-store',
        },
      });
    }

    if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain')) {
      return new Response(JSON.stringify({
        error: 'Upstream returned non-video content',
        contentType,
        url: targetUrl,
      }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const respHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
      'Accept-Ranges': 'bytes',
    };
    if (contentLength) respHeaders['Content-Length'] = contentLength;
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) respHeaders['Content-Range'] = contentRange;
    const respStatus = upstream.status === 206 ? 206 : 200;

    return new Response(upstream.body, {
      status: respStatus,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, url: targetUrl }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

function rewriteM3U8(content, masterUrl, proxyBase, encodedHeaders) {
  const masterDir = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
  const lines = content.split('\n');

  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed) return line;

    if (trimmed.startsWith('#')) {
      const uriMatch = trimmed.match(/URI="([^"]+)"/i);
      if (uriMatch) {
        let absoluteUrl;
        const uriVal = uriMatch[1];
        if (uriVal.startsWith('http://') || uriVal.startsWith('https://')) {
          absoluteUrl = uriVal;
        } else if (uriVal.startsWith('/')) {
          const u = new URL(masterUrl);
          absoluteUrl = `${u.origin}${uriVal}`;
        } else {
          absoluteUrl = masterDir + uriVal;
        }
        const rewritten = `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&h=${encodedHeaders}`;
        return line.replace(uriMatch[0], `URI="${rewritten}"`);
      }
      return line;
    }

    let absoluteUrl;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      absoluteUrl = trimmed;
    } else if (trimmed.startsWith('/')) {
      const u = new URL(masterUrl);
      absoluteUrl = `${u.origin}${trimmed}`;
    } else {
      absoluteUrl = masterDir + trimmed;
    }

    return `${proxyBase}?url=${encodeURIComponent(absoluteUrl)}&h=${encodedHeaders}`;
  }).join('\n');
}
