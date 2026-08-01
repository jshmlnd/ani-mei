const ANIMEPARADISE_ACTION_ID = '608a6ec10f7884a14aaf20f27e564b5e47f1d65c01';

const CORS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const uid = url.searchParams.get('uid');
  const origin = url.searchParams.get('origin');

  if (!uid || !origin) {
    return new Response(JSON.stringify({ error: 'Missing uid or origin parameter' }), { status: 400, headers: CORS });
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
    return new Response(JSON.stringify({ success: true, m3u8 }), { status: 200, headers: CORS });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 502, headers: CORS });
  }
}
