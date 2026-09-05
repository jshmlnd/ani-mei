/**
 * adBlocker.js — Proxy endpoint that fetches embed pages and strips ads.
 *
 * Usage: /api/adBlocker?url=<encoded_embed_url>
 *
 * Fetches the embed page HTML, removes ad-related scripts/elements,
 * injects anti-ad JavaScript, and returns the cleaned HTML.
 */

/* ---------- ad domain / script patterns ---------- */

const AD_SCRIPT_SRC_PATTERNS = [
  /googletagmanager\.com/i,
  /google-analytics\.com/i,
  /googlesyndication\.com/i,
  /doubleclick\.net/i,
  /adskeeper/i,
  /propellerads/i,
  /onclickmax/i,
  /exoclick/i,
  /adnxs\.com/i,
  /adsrvr\.org/i,
  /serving-sys\.com/i,
  /adform\.net/i,
  /taboola\.com/i,
  /outbrain\.com/i,
  /criteo\.com/i,
  /amazon-adsystem\.com/i,
  /adroll\.com/i,
  /moatads\.com/i,
  /adsafeprotected\.com/i,
  /quantserve\.com/i,
  /scorecardresearch\.com/i,
  /bluekai\.com/i,
  /dotomi\.com/i,
  /turn\.com/i,
  /rubiconproject\.com/i,
  /pubmatic\.com/i,
  /openx\.net/i,
  /casalemedia\.com/i,
  /indexww\.com/i,
  /onesignal\.com/i,
  /pushwoosh\.com/i,
  /iclick/i,
  /popcash/i,
  /popads/i,
  /hilltopads/i,
  /juicyads/i,
  /trafficjunky/i,
  /ero-advertising/i,
  /bidvertiser/i,
  /chitika/i,
  /mgid\.com/i,
  /spot\.sc/i,
  /t diminish/i,
];

const AD_INLINE_PATTERNS = [
  /\bgoogletag\b/i,
  /\bgtag\b/i,
  /\b__gads\b/i,
  /\badsbygoogle\b/i,
  /\bdisableDevTool\b/i,
  /\bpopup\s*\(/i,
  /\bwindow\.open\b/i,
  /\btaboola\b/i,
  /\boutbrain\b/i,
];

/* ---------- anti-ad injection script ---------- */

const ANTI_AD_SCRIPT = `
<script data-adblocker="true">
(function(){
  /* Block pop-ups & new windows */
  var origOpen = window.open;
  window.open = function(url, target, features) {
    if (url && (url.indexOf('ad') > -1 || url.indexOf('pop') > -1 || url.indexOf('track') > -1 || url.indexOf('click') > -1)) {
      console.log('[adBlocker] blocked popup:', url);
      return null;
    }
    return origOpen.apply(this, arguments);
  };

  /* Remove ad overlays & banners on load */
  function removeAds() {
    var selectors = [
      '[class*="ad-overlay"]', '[class*="ad-banner"]', '[class*="ad-wrapper"]',
      '[class*="ad-container"]', '[class*="ad-layer"]', '[class*="ad-block"]',
      '[id*="ad-overlay"]', '[id*="ad-banner"]', '[id*="ad-wrapper"]',
      '[id*="google_ads"]', '[id*="taboola"]', '[id*="outbrain"]',
      '.ad', '.ads', '.advert', '.advertisement',
      '[data-ad]', '[data-ads]', '[data-adunit]',
      '[style*="z-index: 9999"]', '[style*="z-index:9999"]',
      '[style*="position: fixed"][style*="width: 100%"]',
    ];
    selectors.forEach(function(sel) {
      try {
        document.querySelectorAll(sel).forEach(function(el) {
          if (el.tagName !== 'VIDEO' && el.tagName !== 'SOURCE' && !el.closest('video')) {
            el.remove();
          }
        });
      } catch(e) {}
    });
  }

  /* MutationObserver to catch dynamically injected ads */
  if (typeof MutationObserver !== 'undefined') {
    var observer = new MutationObserver(function(mutations) {
      var shouldClean = false;
      mutations.forEach(function(m) {
        m.addedNodes.forEach(function(node) {
          if (node.nodeType === 1) {
            var cls = (node.className || '').toString().toLowerCase();
            var id = (node.id || '').toString().toLowerCase();
            if (cls.match(/ad[-_]?/i) || id.match(/ad[-_]?/) ||
                cls.indexOf('popup') > -1 || cls.indexOf('overlay') > -1 ||
                cls.indexOf('modal') > -1 || cls.indexOf('interstitial') > -1) {
              shouldClean = true;
            }
          }
        });
      });
      if (shouldClean) setTimeout(removeAds, 50);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* Initial cleanup */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeAds);
  } else {
    removeAds();
  }

  /* Periodic cleanup for late-loading ads */
  setInterval(removeAds, 2000);

  /* Block beforeunload hijacks (pop-under prevention) */
  window.addEventListener('beforeunload', function(e) {
    delete e.returnValue;
  });
})();
</script>`;

/* ---------- helper: strip ad scripts from HTML ---------- */

function stripAdScripts(html) {
  /* Remove <script> tags whose src matches ad domain patterns */
  let cleaned = html;
  AD_SCRIPT_SRC_PATTERNS.forEach(function(pattern) {
    var regex = new RegExp('<script[^>]*src=["\\\'][^"\\\']*' + pattern.source + '[^"\\\']*["\\\'][^>]*>[\\\\s\\\\S]*?</script>', 'gi');
    cleaned = cleaned.replace(regex, '<!-- adBlocked -->');
  });

  /* Remove inline scripts that contain ad-related code */
  AD_INLINE_PATTERNS.forEach(function(pattern) {
    var regex = new RegExp('<script(?![^>]*data-adblocker)[^>]*>[\\\\s\\\\S]*?' + pattern.source + '[\\\\s\\\\S]*?</script>', 'gi');
    cleaned = cleaned.replace(regex, '<!-- adBlocked -->');
  });

  /* Remove noscript tags (often used as ad fallbacks) */
  cleaned = cleaned.replace(new RegExp('<noscript[^>]*>[\\s\\S]*?</noscript>', 'gi'), '<!-- adBlocked -->');

  return cleaned;
}

/* ---------- helper: inject anti-ad script ---------- */

function injectAntiAd(html) {
  /* Try to inject before </head>, falling back to </body> or end of string */
  var headClose = html.indexOf('</head>');
  if (headClose !== -1) {
    return html.slice(0, headClose) + ANTI_AD_SCRIPT + html.slice(headClose);
  }
  var bodyClose = html.indexOf('</body>');
  if (bodyClose !== -1) {
    return html.slice(0, bodyClose) + ANTI_AD_SCRIPT + html.slice(bodyClose);
  }
  return html + ANTI_AD_SCRIPT;
}

/* ---------- handler ---------- */

export default async function handler(req, res) {
  /* CORS */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }

  const targetUrl = decodeURIComponent(url);

  try {
    const upstream = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.google.com/',
      },
      redirect: 'follow',
    });

    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Upstream returned ${upstream.status}`,
        url: targetUrl,
      });
    }

    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();

    /* Only process HTML pages — pass through everything else */
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      const body = await upstream.arrayBuffer();
      return res.status(upstream.status).setHeader('Content-Type', contentType || 'application/octet-stream').send(Buffer.from(body));
    }

    let html = await upstream.text();

    /* Strip ad scripts and inject anti-ad JavaScript */
    html = stripAdScripts(html);
    html = injectAntiAd(html);

    /* Rewrite relative URLs to absolute */
    try {
      const base = new URL(targetUrl);
      const origin = base.origin;
      html = html.replace(/(src|href|action)=(["'])(\/(?!\/))/gi, '$1=$2' + origin + '$3');
    } catch {}

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-AdBlocker', 'active');
    return res.send(html);
  } catch (err) {
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message, url: targetUrl });
    }
  }
}
