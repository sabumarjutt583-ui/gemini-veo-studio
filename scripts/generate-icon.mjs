/**
 * Generates assets/icon.png — a 256x256 app icon (indigo gradient tile with a
 * white play triangle). electron-builder converts a PNG icon to .ico for the
 * Windows NSIS installer, so no binary .ico needs to be committed.
 *
 * Run: `node scripts/generate-icon.mjs`
 */
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SIZE = 256;
const RADIUS = 48;

// Indigo gradient, top-left -> bottom-right.
const TOP = [129, 140, 248]; // #818cf8
const BOTTOM = [49, 46, 129]; // #312e81

/** Point-in-triangle for the play glyph. */
function inPlayTriangle(x, y) {
  // A(100,80) top-left, B(100,176) bottom-left, C(188,128) right vertex.
  const ax = 100, ay = 80, bx = 100, by = 176, cx = 188, cy = 128;
  if (x < ax) return false;
  const t = (x - ax) / (cx - ax); // 0..1 across the glyph
  const yTop = ay + t * (cy - ay); // upper edge A->C
  const yBot = by + t * (cy - by); // lower edge B->C
  return y >= yTop && y <= yBot;
}

/** Soft circle behind the glyph (subtle highlight). */
function inCircle(x, y) {
  const dx = x - 128, dy = y - 128;
  return dx * dx + dy * dy <= 74 * 74;
}

/** Rounded-rect coverage: true when the pixel center is inside. */
function inRoundedRect(x, y) {
  const cx = Math.min(Math.max(x + 0.5, RADIUS), SIZE - 1 - RADIUS);
  const cy = Math.min(Math.max(y + 0.5, RADIUS), SIZE - 1 - RADIUS);
  const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const o = (y * SIZE + x) * 4;
    if (!inRoundedRect(x, y)) continue; // transparent corner

    const t = (x + y) / (2 * SIZE - 2);
    let r = TOP[0] + (BOTTOM[0] - TOP[0]) * t;
    let g = TOP[1] + (BOTTOM[1] - TOP[1]) * t;
    let b = TOP[2] + (BOTTOM[2] - TOP[2]) * t;

    if (inCircle(x, y)) {
      r += (255 - r) * 0.1;
      g += (255 - g) * 0.1;
      b += (255 - b) * 0.1;
    }
    if (inPlayTriangle(x, y)) [r, g, b] = [255, 255, 255];

    pixels[o] = Math.round(r);
    pixels[o + 1] = Math.round(g);
    pixels[o + 2] = Math.round(b);
    pixels[o + 3] = 255;
  }
}

// --- Minimal PNG encoder (RGBA, 8-bit) ------------------------------------
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// Each scanline is prefixed with a filter byte (0 = none).
const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  raw[y * (SIZE * 4 + 1)] = 0;
  pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type: RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "assets", "icon.png");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes, ${SIZE}x${SIZE} PNG)`);
