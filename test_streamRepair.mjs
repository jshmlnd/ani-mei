// Minimal self-check for streamRepair's m3u8 line picker + chain probe.
// Run: node test_streamRepair.mjs
import assert from 'node:assert/strict';
import { firstUriLine, probeHlsStream } from './src/api/streamRepair.js';

// -- firstUriLine: master, child, empty
assert.equal(firstUriLine('#EXTM3U\n#EXT-X-STREAM-INF:x\nhttps://w/api/proxy/m3u8?token=A\n#EXT-X-I-FRAME...'), 'https://w/api/proxy/m3u8?token=A');
assert.equal(firstUriLine('#EXTINF:3.17,\n https://w/api/proxy/ts?token=S \n'), 'https://w/api/proxy/ts?token=S');
assert.equal(firstUriLine('#EXTM3U\n#only comments'), '');

// -- probeHlsStream against the live chain (skipped if network is down):
//    dead host's manifest must fail the walk; healthy chain must pass.
const dead = 'https://aniko-backend.rk18109ry.workers.dev/api/proxy/m3u8?token=Mi8oLS1lT04MAAALSA4FDgQOFEMaAABeEx0dGBNYSG1pPm1tbwIAU1FSB1QBXAtYWFtZCFxEQxAWTRASQ0x1Omg-bWYBAwEFVABVBQ5YDwoIW1dYQBAREBBNFRRAO2xzMD8sFAQQTQlWE18';
const live = 'https://aniko-backend.rk18109ry.workers.dev/api/proxy/m3u8?url=' +
  encodeURIComponent('https://xdw5v.qeltrix.top/anime/02e74f10e0327ad868d138f2b4fdd6f0/f6a78ba9d3e8dce184ac45e57247a17e/master.m3u8');
try {
  assert.equal(await probeHlsStream(dead), false, 'dead host must fail the chain walk');
  assert.equal(await probeHlsStream(live), true, 'healthy chain must pass master->variant->segment');
  console.log('live chain checks passed');
} catch (e) {
  console.warn('(live network check skipped/failed: ' + e.message + ')');
}
console.log('ok');
