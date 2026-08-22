import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const W = 1200;
const H = 630;
const px = Buffer.alloc(W * H * 4);

const CREAM = [0xf3, 0xee, 0xe2];
const HALO = [0xe0, 0xd9, 0xf5];
const VIOLET = [0x88, 0x73, 0xcf];
const INK = [0x0f, 0x0f, 0x0d];

function setPx(x, y, color) {
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
  const i = (yi * W + xi) * 4;
  px[i] = color[0];
  px[i + 1] = color[1];
  px[i + 2] = color[2];
  px[i + 3] = 255;
}

function fillCircle(cx, cy, rad, color) {
  for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
    for (let x = Math.floor(cx - rad); x <= Math.ceil(cx + rad); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= rad * rad) setPx(x, y, color);
    }
  }
}

function fillRect(x0, y0, x1, y1, color) {
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) setPx(x, y, color);
  }
}

function fillGhost(cx, cy, scale, color) {
  const headR = 150 * scale;
  fillRect(cx - headR, cy, cx + headR, cy + 170 * scale, color);
  fillCircle(cx, cy, headR, color);
  const footY = cy + 170 * scale;
  const footR = 50 * scale;
  fillCircle(cx - 100 * scale, footY, footR, color);
  fillCircle(cx, footY, footR, color);
  fillCircle(cx + 100 * scale, footY, footR, color);
}

for (let i = 0; i < W * H; i++) {
  px[i * 4] = CREAM[0];
  px[i * 4 + 1] = CREAM[1];
  px[i * 4 + 2] = CREAM[2];
  px[i * 4 + 3] = 255;
}

fillCircle(600, 315, 285, HALO);
fillGhost(600, 250, 1, VIOLET);
fillCircle(545, 245, 26, CREAM);
fillCircle(655, 245, 26, CREAM);

const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8;
ihdr[9] = 6;

const raw = Buffer.alloc((W * 4 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0;
  px.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}

const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og-image.png');
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
