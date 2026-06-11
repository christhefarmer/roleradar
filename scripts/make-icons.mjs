// Generates the PWA icon set (icons/radar-192.png, radar-512.png,
// radar-maskable-512.png, apple-touch-icon.png) without native image deps:
// a minimal PNG encoder + a pixel-drawn approximation of the hat-glasses
// mark in white on Radar green (#1E8A4F).
//
// These are committed placeholders per the handoff ("supply real PNGs under
// /icons/"); regenerate or replace with rendered exports of icons/radar.svg
// at any time. Run: npm run icons

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const GREEN = [0x1e, 0x8a, 0x4f, 255];
const WHITE = [255, 255, 255, 255];

// ---- PNG encoding ----------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  // raw scanlines with filter byte 0
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    pixels.copy(raw, row + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---- drawing ---------------------------------------------------------------

function drawIcon(size, { pad = 0, radius = 0.22 } = {}) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, c) => {
    const i = (y * size + x) * 4;
    px[i] = c[0];
    px[i + 1] = c[1];
    px[i + 2] = c[2];
    px[i + 3] = c[3];
  };

  // Glyph geometry in unit space (drawn inside the padded box).
  const g = (v) => pad + v * (1 - 2 * pad);
  const cy = g(0.64); // glasses centerline
  const r = 0.115 * (1 - 2 * pad); // lens radius
  const lx = g(0.33);
  const rx = g(0.67);
  const brimY1 = g(0.42);
  const brimY2 = g(0.475);
  const brimX1 = g(0.14);
  const brimX2 = g(0.86);
  const crownX1 = g(0.3);
  const crownX2 = g(0.7);
  const crownY1 = g(0.18);

  const cornerR = radius * size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x + 0.5) / size;
      const v = (y + 0.5) / size;

      // rounded-square green field (full bleed when radius = 0 for maskable)
      let inside = true;
      if (cornerR > 0) {
        const dx = Math.max(cornerR - x - 0.5, x + 0.5 - (size - cornerR), 0);
        const dy = Math.max(cornerR - y - 0.5, y + 0.5 - (size - cornerR), 0);
        inside = dx * dx + dy * dy <= cornerR * cornerR;
      }
      if (!inside) continue; // transparent corner
      let c = GREEN;

      // hat crown + brim
      if (u >= crownX1 && u <= crownX2 && v >= crownY1 && v < brimY1) c = WHITE;
      if (u >= brimX1 && u <= brimX2 && v >= brimY1 && v <= brimY2) c = WHITE;
      // glasses: two filled lenses + bridge
      const dl = (u - lx) ** 2 + (v - cy) ** 2;
      const dr = (u - rx) ** 2 + (v - cy) ** 2;
      if (dl <= r * r || dr <= r * r) c = WHITE;
      if (u > lx && u < rx && Math.abs(v - cy) < 0.022) c = WHITE;

      set(x, y, c);
    }
  }
  return encodePng(size, px);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

writeFileSync(join(outDir, 'radar-192.png'), drawIcon(192));
writeFileSync(join(outDir, 'radar-512.png'), drawIcon(512));
// Maskable: full-bleed field, glyph inside the 40% safe zone.
writeFileSync(join(outDir, 'radar-maskable-512.png'), drawIcon(512, { pad: 0.14, radius: 0 }));
writeFileSync(join(outDir, 'apple-touch-icon.png'), drawIcon(180, { radius: 0 }));

console.log('icons written to public/icons/');
