import test from 'node:test';
import assert from 'node:assert/strict';
import { getExternalSubtitleIndex } from './videoTracks.js';

test('identifies the selected external subtitle for native fullscreen', () => {
  const options = [
    { kind: 'hls', index: 0 },
    { kind: 'ext', index: 2 },
  ];

  assert.equal(getExternalSubtitleIndex(1, options), 2);
  assert.equal(getExternalSubtitleIndex(0, options), -1);
  assert.equal(getExternalSubtitleIndex(-1, options), -1);
});
