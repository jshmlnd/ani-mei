// Minimal WebVTT parser (core subset) for the custom subtitle renderer.
// Supports: WEBVTT header, cue identifiers, mm:ss.mmm + hh:mm:ss.mmm
// timestamps (dot or comma decimals), cue `align:` setting, multi-line and
// overlapping cues, inline <i>/<b>/<u>/<c>/<v> tags (styling hooks other
// than i/b/u are stripped). Skips NOTE/STYLE/REGION blocks and malformed
// cues defensively. Everything else (line/position/size, karaoke) is ignored.

export function parseTimestamp(raw) {
  if (typeof raw !== 'string') return null;
  const m = raw.trim().replace(',', '.').match(/^(?:(\d+):)?([0-5]?\d):([0-5]?\d)\.(\d{1,3})$/);
  if (!m) return null;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const mins = parseInt(m[2], 10);
  const secs = parseInt(m[3], 10);
  const ms = parseInt((m[4] + '000').slice(0, 3), 10);
  if (Number.isNaN(hours) || Number.isNaN(mins) || Number.isNaN(secs) || Number.isNaN(ms)) return null;
  return hours * 3600 + mins * 60 + secs + ms / 1000;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Split cue payload text into styled segments. Unknown/unsupported tags are
// stripped; raw angle brackets are escaped so dialogue can never become markup.
function parseInline(text) {
  const segs = [];
  const stack = [];
  const current = () => ({
    italic: stack.includes('i'),
    bold: stack.includes('b'),
    underline: stack.includes('u'),
  });
  const tagRe = /<\/?([ibu]|c|v)(?:\s[^<>]*)?>/gi;
  let last = 0;
  let m;
  while ((m = tagRe.exec(text)) !== null) {
    if (m.index > last) {
      segs.push({ text: decodeEntities(text.slice(last, m.index)), ...current() });
    }
    const tag = m[1].toLowerCase();
    if (tag === 'i' || tag === 'b' || tag === 'u') {
      if (m[0][1] === '/') {
        const idx = stack.lastIndexOf(tag);
        if (idx >= 0) stack.splice(idx, 1);
      } else {
        stack.push(tag);
      }
    }
    last = tagRe.lastIndex;
  }
  if (last < text.length) {
    segs.push({ text: decodeEntities(text.slice(last)), ...current() });
  }
  return segs.filter((s) => s.text.length > 0);
}

function parseCueSettings(settingsStr) {
  let align = 'center';
  if (settingsStr) {
    const m = /(?:^|\s)align:(start|center|end|left|right)(?:\s|$)/i.exec(settingsStr);
    if (m) {
      const a = m[1].toLowerCase();
      align = a === 'left' || a === 'start' ? 'left' : a === 'right' || a === 'end' ? 'right' : 'center';
    }
  }
  return align;
}

export function parseVtt(input) {
  if (typeof input !== 'string') return [];
  const src = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = src.split('\n');
  if (!lines[0] || !lines[0].trim().startsWith('WEBVTT')) return [];

  const cues = [];
  let block = [];
  const flush = () => {
    if (block.length) {
      const cue = parseCueBlock(block);
      if (cue) cues.push(cue);
    }
    block = [];
  };

  // Start after the header line; header metadata runs until the first blank line
  let i = 1;
  while (i < lines.length && lines[i].trim() !== '') i++;
  i++;
  for (; i < lines.length; i++) {
    if (lines[i].trim() === '') {
      flush();
    } else {
      block.push(lines[i]);
    }
  }
  flush();

  cues.sort((a, b) => a.start - b.start || a.end - b.end);
  return cues;
}

function parseCueBlock(block) {
  if (!block.length) return null;
  const first = block[0].trim();
  // Skip non-cue blocks
  if (/^(NOTE|STYLE|REGION)\b/.test(first)) return null;

  let timingLine = first;
  if (!timingLine.includes('-->') && block.length > 1) {
    // First line is a cue identifier; timing is on the next line
    timingLine = block[1].trim();
    block = block.slice(1);
  }
  const tm = timingLine.match(/^(.+?)\s+-->\s+(.+?)(?:\s+(.*))?$/);
  if (!tm) return null;
  const start = parseTimestamp(tm[1]);
  const end = parseTimestamp(tm[2]);
  if (start == null || end == null || end <= start) return null;

  const payload = block.slice(1);
  // Drop trailing empty payload lines
  while (payload.length && payload[payload.length - 1].trim() === '') payload.pop();
  if (!payload.length) return null;

  const align = parseCueSettings(tm[3] || '');
  const lines = payload.map((line) => parseInline(line)).filter((segs) => segs.length > 0);
  if (!lines.length) return null;
  return { start, end, align, lines };
}

// Cues must be sorted by start (parseVtt guarantees this). Returns every cue
// with start <= t < end, oldest first.
export function findActiveCues(cues, t) {
  if (!cues || !cues.length || typeof t !== 'number' || Number.isNaN(t)) return [];
  let lo = 0;
  let hi = cues.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) lo = mid + 1;
    else hi = mid;
  }
  const out = [];
  for (let i = lo - 1; i >= 0 && cues[i].end > t; i--) {
    out.unshift(cues[i]);
    if (out.length >= 4) break; // layout safety cap
  }
  return out;
}
