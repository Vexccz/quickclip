// Generates build/icon.png (256x256) for QuickClip.
// Uses only built-in modules so no extra deps.
// Renders a 256x256 RGBA PNG: dark rounded square + teal paperclip + speed lines.

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const W = 256;
const H = 256;
const buf = Buffer.alloc(W * H * 4);

function idx(x, y) {
  return (y * W + x) * 4;
}

function set(x, y, r, g, b, a = 255) {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = idx(x, y);
  const ai = a / 255;
  const inv = 1 - ai;
  buf[i] = Math.round(buf[i] * inv + r * ai);
  buf[i + 1] = Math.round(buf[i + 1] * inv + g * ai);
  buf[i + 2] = Math.round(buf[i + 2] * inv + b * ai);
  buf[i + 3] = Math.max(buf[i + 3], a);
}

// fill background with rounded-corner dark panel
const radius = 44;
function insideRounded(x, y) {
  if (x >= radius && x <= W - radius - 1) return y >= 0 && y < H;
  if (y >= radius && y <= H - radius - 1) return x >= 0 && x < W;
  const cx = x < radius ? radius : W - radius - 1;
  const cy = y < radius ? radius : H - radius - 1;
  const dx = x - cx;
  const dy = y - cy;
  return dx * dx + dy * dy <= radius * radius;
}

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (insideRounded(x, y)) {
      // gentle vertical gradient
      const t = y / H;
      const r = Math.round(11 + 6 * t);
      const g = Math.round(15 + 10 * t);
      const b = Math.round(20 + 15 * t);
      set(x, y, r, g, b, 255);
    }
  }
}

// teal accent glow near top
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const cx = W / 2;
    const cy = H / 2 - 20;
    const dx = x - cx;
    const dy = y - cy;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (!insideRounded(x, y)) continue;
    const strength = Math.max(0, 1 - d / 180);
    if (strength > 0) {
      set(x, y, 20, 184, 166, Math.round(strength * 40));
    }
  }
}

// stroke drawing primitives
function drawLine(x0, y0, x1, y1, r, g, b, thickness = 6) {
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    drawDot(x, y, thickness / 2, r, g, b);
  }
}

function drawDot(cx, cy, radius, r, g, b) {
  const r2 = radius * radius;
  for (let y = Math.floor(cy - radius - 1); y <= Math.ceil(cy + radius + 1); y++) {
    for (let x = Math.floor(cx - radius - 1); x <= Math.ceil(cx + radius + 1); x++) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2) {
        set(x, y, r, g, b, 255);
      } else if (d2 <= (radius + 1) * (radius + 1)) {
        const a = 255 * (1 - (Math.sqrt(d2) - radius));
        set(x, y, r, g, b, Math.max(0, Math.min(255, Math.round(a))));
      }
    }
  }
}

function drawArc(cx, cy, radius, startAngle, endAngle, r, g, b, thickness = 6) {
  const steps = Math.ceil(Math.abs(endAngle - startAngle) * radius * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = startAngle + (endAngle - startAngle) * t;
    const x = cx + Math.cos(a) * radius;
    const y = cy + Math.sin(a) * radius;
    drawDot(x, y, thickness / 2, r, g, b);
  }
}

// paperclip: two nested U-shapes, slightly rotated
// We'll draw a classic paperclip silhouette centered
const cx = W / 2 + 10;
const cy = H / 2 + 6;

// teal primary
const TEAL_R = 20, TEAL_G = 184, TEAL_B = 166;
const CYAN_R = 34, CYAN_G = 211, CYAN_B = 238;

// Outer clip loop
drawArc(cx - 18, cy - 30, 42, Math.PI, Math.PI * 2, TEAL_R, TEAL_G, TEAL_B, 14);
drawLine(cx + 24, cy - 30, cx + 24, cy + 38, TEAL_R, TEAL_G, TEAL_B, 14);
drawArc(cx + 2, cy + 38, 22, 0, Math.PI, TEAL_R, TEAL_G, TEAL_B, 14);
drawLine(cx - 20, cy + 38, cx - 20, cy - 18, TEAL_R, TEAL_G, TEAL_B, 14);

// Inner loop (shorter)
drawArc(cx - 18, cy - 30, 22, Math.PI, Math.PI * 2, CYAN_R, CYAN_G, CYAN_B, 12);
drawLine(cx + 4, cy - 30, cx + 4, cy + 18, CYAN_R, CYAN_G, CYAN_B, 12);

// speed lines (left side)
drawLine(36, 90, 78, 90, TEAL_R, TEAL_G, TEAL_B, 8);
drawLine(22, 130, 70, 130, CYAN_R, CYAN_G, CYAN_B, 8);
drawLine(36, 170, 78, 170, TEAL_R, TEAL_G, TEAL_B, 8);

// ---------- PNG encode ----------
function crc32(buf) {
  let c;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

// add filter byte per row
const raw = Buffer.alloc(H * (W * 4 + 1));
for (let y = 0; y < H; y++) {
  raw[y * (W * 4 + 1)] = 0; // filter: None
  buf.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
}
const idat = zlib.deflateSync(raw);

const png = Buffer.concat([
  signature,
  chunk('IHDR', ihdr),
  chunk('IDAT', idat),
  chunk('IEND', Buffer.alloc(0))
]);

const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes');
