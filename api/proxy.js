export default async function handler(req, res) {
  const { url, h } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const targetUrl = decodeURIComponent(url);
  const headers = h ? JSON.parse(decodeURIComponent(h)) : {};

  try {
    const fetchHeaders = {
      'Referer': headers.Referer || 'https://play2.echovideo.ru/',
      'Origin': headers.Origin || 'https://play2.echovideo.ru',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    if (headers.Range) fetchHeaders['Range'] = headers.Range;
    if (headers['Accept-Ranges']) fetchHeaders['Accept-Ranges'] = headers['Accept-Ranges'];

    const upstream = await fetch(targetUrl, { headers: fetchHeaders });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream returned ${upstream.status}`,
        url: targetUrl,
      });
    }

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    const contentLength = upstream.headers.get('content-length');

    const isLikelyM3u8 = contentType.includes('mpegurl') || contentType.includes('m3u8')
      || /\.m3u8($|\?)/i.test(targetUrl)
      || contentType.includes('image/jpeg');

    if (isLikelyM3u8) {
      const body = await upstream.text();
      const firstChars = body.trimStart().slice(0, 10);
      if (firstChars.startsWith('#EXTM3U')) {
        const origin = req.headers.origin || 'https://animei-snowy.vercel.app';
        const proxyBase = `${origin}/api/proxy`;
        const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
        const rewritten = rewriteM3U8(body, targetUrl, proxyBase, encodedHeaders);

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=2');
        return res.send(rewritten);
      }
      if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain') || contentType.includes('image/')) {
        return res.status(502).json({
          error: 'M3U8 URL returned non-video content',
          contentType,
          url: targetUrl,
        });
      }
      return res.status(502).json({
        error: 'M3U8 URL returned non-M3U8 content',
        contentType,
        url: targetUrl,
      });
    }

    if (contentType.includes('text/html') || contentType.includes('application/json') || contentType.includes('text/plain') || contentType.includes('image/')) {
      return res.status(502).json({
        error: 'Upstream returned non-video content',
        contentType,
        url: targetUrl,
      });
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Accept-Ranges', 'bytes');
    if (contentLength) res.setHeader('Content-Length', contentLength);
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) res.setHeader('Content-Range', contentRange);
    const status = upstream.status === 206 ? 206 : 200;
    res.status(status);

    const reader = upstream.body.getReader();
    const write = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) { res.end(); return; }
        res.write(value);
      }
    };
    await write();
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message, url: targetUrl });
    }
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
