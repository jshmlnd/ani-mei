const ANIMEPARADISE_ACTION_ID = '608a6ec10f7884a14aaf20f27e564b5e47f1d65c01';

export default async function handler(req, res) {
  const { uid, origin } = req.query;

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!uid || !origin) {
    return res.status(400).json({ error: 'Missing uid or origin parameter' });
  }

  try {
    const watchUrl = `https://www.animeparadise.moe/watch/${encodeURIComponent(uid)}?origin=${encodeURIComponent(origin)}`;
    const body = JSON.stringify([uid, origin]);
    const upstream = await fetch(watchUrl, {
      method: 'POST',
      headers: {
        'next-action': ANIMEPARADISE_ACTION_ID,
        accept: 'text/x-component',
        'content-type': 'text/plain;charset=UTF-8',
        referer: watchUrl,
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'accept-language': 'en-US,en;q=0.9',
      },
      body,
    });
    const text = await upstream.text();
    const match = text.match(/"streamLink":"([^"]+)"/);
    if (!match) throw new Error('No streamLink in RSC response');

    const masterUrl = `https://stream.animeparadise.moe/m3u8?url=${encodeURIComponent(match[1])}`;
    const masterRes = await fetch(masterUrl);
    const masterText = await masterRes.text();
    const variantLine = masterText.split('\n').map((l) => l.trim()).find((l) => l.startsWith('/') || l.startsWith('http'));
    const m3u8 = variantLine ? new URL(variantLine, masterUrl).toString() : masterUrl;
    return res.json({ success: true, m3u8 });
  } catch (err) {
    return res.status(502).json({ success: false, error: err.message });
  }
}
