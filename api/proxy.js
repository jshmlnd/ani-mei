export default async function handler(req, res) {
  const { url, h } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const targetUrl = decodeURIComponent(url);
  const headers = h ? JSON.parse(decodeURIComponent(h)) : {};

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'Referer': headers.Referer || 'https://play2.echovideo.ru/',
        'Origin': headers.Origin || 'https://play2.echovideo.ru',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream returned ${upstream.status}`,
        url: targetUrl,
      });
    }

    const buffer = await upstream.arrayBuffer();
    const firstBytes = new Uint8Array(buffer.slice(0, 32));
    const textPreview = new TextDecoder().decode(firstBytes).trimStart();
    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('json') || textPreview.startsWith('{') || textPreview.startsWith('[');
    const isM3u8 = textPreview.startsWith('#EXTM3U') && (
      contentType.includes('mpegurl') ||
      contentType.includes('m3u8') ||
      /\.m3u8($|\?)/i.test(targetUrl)
    );

    if (isJson && !isM3u8) {
      return res.status(502).json({
        error: 'Upstream returned non-video response',
        url: targetUrl,
        body: new TextDecoder().decode(buffer).slice(0, 500),
      });
    }

    if (isM3u8) {
      const body = new TextDecoder().decode(buffer);
      const origin = req.headers.origin || 'https://animei-snowy.vercel.app';
      const proxyBase = `${origin}/api/proxy`;
      const encodedHeaders = encodeURIComponent(JSON.stringify(headers));
      const rewritten = rewriteM3U8(body, targetUrl, proxyBase, encodedHeaders);

      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache');
      return res.send(rewritten);
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', contentType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(new Uint8Array(buffer));
  } catch (err) {
    return res.status(500).json({ error: err.message, url: targetUrl });
  }
}

function rewriteM3U8(content, masterUrl, proxyBase, encodedHeaders) {
  const masterDir = masterUrl.substring(0, masterUrl.lastIndexOf('/') + 1);
  const lines = content.split('\n');

  return lines.map(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return line;

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
