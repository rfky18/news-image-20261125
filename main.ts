// THE WORLD IN ONE DAY — Wednesday 25 November 2026
// make.fun news-image-20261125 entry generator.
// Deterministic, offline, stdlib-only Node. Renders a dense classic
// newspaper front page (35 dated stories, 7 regions) from a pre-built
// bitmap font atlas (assets/atlas.png + atlas.json) and flat vector art
// drawn in code. No photos, no network at runtime.
import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------- palette ----------
const PAPER = 0xf6f1e5;
const INK = 0x161513;
const RED = 0xa81f24;
const NAVY = 0x1d2f57;
const GREEN = 0x1e6b34;
const GOLD = 0x8a6d1b;
const MUTED = 0x5a5348;
const CARD = 0xfffdf6;
const SKY = 0xcfe0e8;

// ---------- canvas ----------
const buf = new Uint8Array(W * H * 4);
function fillAll(c: number) {
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  for (let i = 0; i < W * H; i++) {
    buf[i * 4] = r; buf[i * 4 + 1] = g; buf[i * 4 + 2] = b; buf[i * 4 + 3] = 255;
  }
}
function px(x: number, y: number, c: number, a = 1) {
  x = Math.round(x); y = Math.round(y);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  if (a >= 1) { buf[i] = (c >> 16) & 255; buf[i + 1] = (c >> 8) & 255; buf[i + 2] = c & 255; buf[i + 3] = 255; }
  else {
    buf[i] = Math.round(buf[i] * (1 - a) + ((c >> 16) & 255) * a);
    buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + ((c >> 8) & 255) * a);
    buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + (c & 255) * a);
  }
}
function rect(x: number, y: number, w: number, h: number, c: number, a = 1) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) px(i, j, c, a);
}
function hline(x: number, y: number, w: number, t: number, c: number) { rect(x, y, w, t, c); }
function vline(x: number, y: number, h: number, t: number, c: number) { rect(x, y, t, h, c); }
function circle(cx: number, cy: number, r: number, c: number, a = 1) {
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    if (i * i + j * j <= r * r) px(cx + i, cy + j, c, a);
  }
}
function ellipse(cx: number, cy: number, rx: number, ry: number, c: number, a = 1) {
  for (let j = -ry; j <= ry; j++) for (let i = -rx; i <= rx; i++) {
    if ((i * i) / (rx * rx) + (j * j) / (ry * ry) <= 1) px(cx + i, cy + j, c, a);
  }
}
function poly(pts: [number, number][], c: number, a = 1) {
  let minY = 1e9, maxY = -1e9;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.ceil(minY); y <= Math.floor(maxY); y++) {
    const xs: number[] = [];
    for (let k = 0; k < pts.length; k++) {
      const [x1, y1] = pts[k], [x2, y2] = pts[(k + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k]); x <= Math.floor(xs[k + 1]); x++) px(x, y, c, a);
    }
  }
}
function line(x1: number, y1: number, x2: number, y2: number, w: number, c: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const n = Math.max(Math.abs(dx), Math.abs(dy), 1);
  for (let i = 0; i <= n; i++) circle(Math.round(x1 + (dx * i) / n), Math.round(y1 + (dy * i) / n), Math.max(1, Math.floor(w / 2)), c);
}
function frame(x: number, y: number, w: number, h: number, t: number, c: number) {
  hline(x, y, w, t, c); hline(x, y + h - t, w, t, c);
  vline(x, y, h, t, c); vline(x + w - t, y, h, t, c);
}

// ---------- PNG decode (atlas: 8-bit grayscale) ----------
function crc32(data: Buffer): number {
  let table: number[] | null = (crc32 as any)._t;
  if (!table) {
    table = []; (crc32 as any)._t = table;
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (const b of data) crc = table[(crc ^ b) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([td, data])));
  return Buffer.concat([len, td, data, crc]);
}
function decodePng(file: Buffer): { w: number; h: number; gray: Uint8Array } {
  let off = 8, w = 0, h = 0, bitDepth = 8, colorType = 0;
  const idats: Buffer[] = [];
  while (off < file.length) {
    const len = file.readUInt32BE(off);
    const type = file.toString("ascii", off + 4, off + 8);
    const data = file.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bitDepth = data[8]; colorType = data[9]; }
    else if (type === "IDAT") idats.push(Buffer.from(data));
    else if (type === "IEND") break;
    off += 12 + len;
  }
  if (bitDepth !== 8 || colorType !== 0) throw new Error(`unsupported atlas PNG depth=${bitDepth} type=${colorType}`);
  const raw = zlib.inflateSync(Buffer.concat(idats));
  const stride = w;
  const gray = new Uint8Array(w * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[p++];
    const row = raw.subarray(p, p + stride); p += stride;
    const prev = y > 0 ? gray.subarray((y - 1) * w, y * w) : null;
    for (let x = 0; x < w; x++) {
      const a = x > 0 ? gray[y * w + x - 1] : 0;
      const b = prev ? prev[x] : 0;
      const cc = x > 0 && prev ? prev[x - 1] : 0;
      let v = row[x];
      if (f === 1) v = (v + a) & 255;
      else if (f === 2) v = (v + b) & 255;
      else if (f === 3) v = (v + ((a + b) >> 1)) & 255;
      else if (f === 4) {
        const pa = Math.abs(b - cc), pb = Math.abs(a - cc), pc = Math.abs(a + b - 2 * cc);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : cc;
        v = (v + pr) & 255;
      }
      gray[y * w + x] = v;
    }
  }
  return { w, h, gray };
}

// ---------- font atlas ----------
type Glyph = [number, number, number, number, number, number, number]; // x,y,w,h,adv,xoff,yoff
let atlasGray: Uint8Array, atlasW = 0;
let glyphs: Record<string, Record<string, Glyph>> = {};
let metrics: Record<string, { asc: number; desc: number; size: number }> = {};
function loadAtlas(dir: string) {
  const meta = JSON.parse(fs.readFileSync(path.join(dir, "atlas.json"), "utf8"));
  glyphs = meta.glyphs; metrics = meta.metrics;
  const dec = decodePng(fs.readFileSync(path.join(dir, "atlas.png")));
  atlasGray = dec.gray; atlasW = dec.w;
}
function textWidth(s: string, spec: string): number {
  const g = glyphs[spec]; let w = 0;
  for (const ch of s) { const gl = g[ch]; if (gl) w += gl[4]; }
  return w;
}
function drawText(x: number, yTop: number, s: string, spec: string, color: number, align: "l" | "c" | "r" = "l", maxW = 0) {
  const g = glyphs[spec];
  let w = textWidth(s, spec);
  let scale = 1;
  if (maxW > 0 && w > maxW) scale = maxW / w;
  let px0 = x;
  if (align === "c") px0 = x - (w * scale) / 2;
  if (align === "r") px0 = x - w * scale;
  let pen = px0;
  for (const ch of s) {
    const gl = g[ch];
    if (!gl) continue;
    const [gx, gy, gw, gh, adv, xoff, yoff] = gl;
    if (gw > 0 && gh > 0) {
      for (let j = 0; j < gh; j++) {
        for (let i = 0; i < gw; i++) {
          const a = atlasGray[(gy + j) * atlasW + gx + i] / 255;
          if (a > 0) px(Math.round(pen + xoff * scale) + i, Math.round(yTop + yoff * scale) + j, color, a);
        }
      }
    }
    pen += adv * scale;
  }
  return w * scale;
}
function wrap(s: string, spec: string, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    const t = cur ? cur + " " + wd : wd;
    if (textWidth(t, spec) <= maxW) cur = t;
    else { if (cur) lines.push(cur); cur = wd; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function para(x: number, yTop: number, s: string, spec: string, color: number, maxW: number, lh: number, maxLines = 99): number {
  const lines = wrap(s, spec, maxW).slice(0, maxLines);
  lines.forEach((ln, i) => drawText(x, yTop + i * lh, ln, spec, color));
  return yTop + lines.length * lh;
}

// ---------- flags (tiny, programmatic) ----------
function flag(x: number, y: number, w: number, h: number, code: string) {
  frame(x, y, w, h, 1, INK);
  const t = h / 3;
  if (code === "YE") { rect(x + 1, y + 1, w - 2, t, 0xc8102e); rect(x + 1, y + 1 + t, w - 2, t, 0xffffff); rect(x + 1, y + 1 + 2 * t, w - 2, h - 2 - 2 * t, 0x111111); }
  else if (code === "UA") { rect(x + 1, y + 1, w - 2, h / 2, 0x2a6fc2); rect(x + 1, y + 1 + h / 2, w - 2, h / 2 - 1, 0xffd800); }
  else if (code === "CO") { rect(x + 1, y + 1, w - 2, h / 2, 0xffd800); rect(x + 1, y + 1 + h / 2, w - 2, h / 4, 0x2a4fa2); rect(x + 1, y + 1 + (3 * h) / 4, w - 2, h / 4 - 1, 0xc8102e); }
  else if (code === "CN") { rect(x + 1, y + 1, w - 2, h - 2, 0xd80c18); circle(x + 7, y + 5, 2, 0xffd800); }
  else if (code === "FR") { rect(x + 1, y + 1, w / 3, h - 2, 0x1e3a8a); rect(x + 1 + w / 3, y + 1, w / 3, h - 2, 0xffffff); rect(x + 1 + (2 * w) / 3, y + 1, w - 2 - (2 * w) / 3, h - 2, 0xc8102e); }
  else if (code === "AU") { rect(x + 1, y + 1, w - 2, h - 2, 0x1d3f8a); rect(x + 1, y + 1, w / 2, h / 2, 0xffffff); circle(x + w - 6, y + h - 6, 2, 0xffffff); }
  else if (code === "SB") { poly([[x + 1, y + h - 1], [x + w - 1, y + 1], [x + w - 1, y + h - 1]], 0x1e7a34); rect(x + 1, y + 1, w - 2, h - 2, 0x00000000, 0); poly([[x + 1, y + 1], [x + w - 1, y + 1], [x + 1, y + h - 1]], 0x1d3f8a); circle(x + 6, y + 5, 1, 0xffffff); circle(x + 12, y + 8, 1, 0xffffff); }
  else if (code === "US") { for (let i = 0; i < 5; i++) rect(x + 1, y + 1 + i * (h / 5), w - 2, h / 10, i % 2 ? 0xffffff : 0xc8102e); rect(x + 1, y + 1, w * 0.45, h * 0.55, 0x1d2f57); }
  else if (code === "RU") { rect(x + 1, y + 1, w - 2, t, 0xffffff); rect(x + 1, y + 1 + t, w - 2, t, 0x2a4fa2); rect(x + 1, y + 1 + 2 * t, w - 2, h - 2 - 2 * t, 0xc8102e); }
  else { rect(x + 1, y + 1, w - 2, h - 2, 0xdddddd); }
}

// ---------- vignette scenes (flat vector, drawn in code) ----------
function sky(x: number, y: number, w: number, h: number, top: number, mid: number, bot: number) {
  rect(x, y, w, h / 3, top); rect(x, y + h / 3, w, h / 3, mid); rect(x, y + (2 * h) / 3, w, h - (2 * h) / 3, bot);
}
function grad(x: number, y: number, w: number, h: number, c1: number, c2: number, steps = 12) {
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const r = Math.round((((c1 >> 16) & 255) * (1 - t) + ((c2 >> 16) & 255) * t));
    const g = Math.round((((c1 >> 8) & 255) * (1 - t) + ((c2 >> 8) & 255) * t));
    const b = Math.round(((c1 & 255) * (1 - t) + (c2 & 255) * t));
    rect(x, y + (h * i) / steps, w, h / steps + 1, (r << 16) | (g << 8) | b);
  }
}
function smoke(x: number, y: number, s: number, c: number) {
  circle(x, y, s, c, 0.85); circle(x + s * 0.7, y - s * 0.5, s * 0.8, c, 0.8); circle(x - s * 0.6, y - s * 0.6, s * 0.7, c, 0.8); circle(x + s * 0.3, y - s * 1.1, s * 0.6, c, 0.75);
}
function sceneHodeidah(x: number, y: number, w: number, h: number) {
  grad(x, y, w, h * 0.62, 0x2a2340, 0xe08a4a);
  circle(x + w * 0.76, y + h * 0.34, 14, 0xffd9a0);
  circle(x + w * 0.76, y + h * 0.34, 20, 0xffd9a0, 0.25);
  rect(x, y + h * 0.62, w, h * 0.38, 0x16324a); // sea
  hline(x, y + h * 0.62, w, 2, 0x4a7a9a);
  // distant port silhouette
  rect(x + w * 0.04, y + h * 0.50, w * 0.30, h * 0.12, 0x1a1a22);
  rect(x + w * 0.38, y + h * 0.54, w * 0.22, h * 0.08, 0x1a1a22);
  // two cranes
  line(x + w * 0.12, y + h * 0.62, x + w * 0.12, y + h * 0.26, 3, 0x14141a);
  line(x + w * 0.12, y + h * 0.26, x + w * 0.24, y + h * 0.36, 2, 0x14141a);
  line(x + w * 0.30, y + h * 0.62, x + w * 0.30, y + h * 0.32, 3, 0x14141a);
  line(x + w * 0.30, y + h * 0.32, x + w * 0.40, y + h * 0.40, 2, 0x14141a);
  // containers on the pier
  rect(x + w * 0.62, y + h * 0.52, w * 0.09, h * 0.10, 0xb8542a);
  rect(x + w * 0.72, y + h * 0.52, w * 0.09, h * 0.10, 0x2a6f8a);
  rect(x + w * 0.67, y + h * 0.42, w * 0.09, h * 0.10, 0x8a7a2a);
  // ship in the foreground
  poly([[x + w * 0.10, y + h * 0.70], [x + w * 0.46, y + h * 0.70], [x + w * 0.42, y + h * 0.86], [x + w * 0.14, y + h * 0.86]], 0x0e0e12);
  rect(x + w * 0.20, y + h * 0.62, w * 0.09, h * 0.08, 0xdddddd);
  rect(x + w * 0.20, y + h * 0.64, w * 0.09, 2, 0x2a4fa2);
  smoke(x + w * 0.56, y + h * 0.44, 9, 0x3a3a3a);
  circle(x + w * 0.56, y + h * 0.54, 5, 0xff8a2a);
  circle(x + w * 0.58, y + h * 0.52, 3, 0xffd23a);
}
function sceneRocket(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, 0x0a1230);
  for (const [sx, sy, r] of [[0.1, 0.15, 1], [0.3, 0.08, 1], [0.55, 0.2, 2], [0.8, 0.1, 1], [0.9, 0.35, 1], [0.2, 0.4, 1], [0.68, 0.45, 1], [0.45, 0.05, 1]] as const) circle(x + w * sx, y + h * sy, r, 0xffffff);
  circle(x + w * 0.72, y + h * 0.22, 10, 0xe8e0c8, 0.9); // moon
  rect(x, y + h * 0.78, w, h * 0.22, 0x2a2a2a);
  line(x + w * 0.30, y + h * 0.78, x + w * 0.30, y + h * 0.30, 3, 0x666666);
  line(x + w * 0.62, y + h * 0.78, x + w * 0.62, y + h * 0.35, 3, 0x666666);
  // rocket
  poly([[x + w * 0.46, y + h * 0.30], [x + w * 0.54, y + h * 0.30], [x + w * 0.54, y + h * 0.62], [x + w * 0.46, y + h * 0.62]], 0xeeeeee);
  poly([[x + w * 0.46, y + h * 0.30], [x + w * 0.50, y + h * 0.18], [x + w * 0.54, y + h * 0.30]], 0xc8102e);
  poly([[x + w * 0.46, y + h * 0.62], [x + w * 0.50, y + h * 0.78], [x + w * 0.54, y + h * 0.62]], 0xff8a2a);
  poly([[x + w * 0.44, y + h * 0.52], [x + w * 0.46, y + h * 0.52], [x + w * 0.46, y + h * 0.66], [x + w * 0.44, y + h * 0.66]], 0xc8102e);
  poly([[x + w * 0.54, y + h * 0.52], [x + w * 0.56, y + h * 0.52], [x + w * 0.56, y + h * 0.66], [x + w * 0.54, y + h * 0.66]], 0xc8102e);
  circle(x + w * 0.50, y + h * 0.40, 3, 0x2a6fc2);
}
function sceneStocks(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, 0x101418);
  for (let i = 1; i < 4; i++) hline(x + 6, y + (h * i) / 4, w - 12, 1, 0x2a2a2a);
  poly([[x + 8, y + h * 0.22], [x + w * 0.3, y + h * 0.30], [x + w * 0.45, y + h * 0.28], [x + w * 0.6, y + h * 0.52], [x + w * 0.75, y + h * 0.62], [x + w * 0.92, y + h * 0.82]], 0x00000000, 0);
  line(x + 8, y + h * 0.22, x + w * 0.3, y + h * 0.30, 3, 0xc8102e);
  line(x + w * 0.3, y + h * 0.30, x + w * 0.45, y + h * 0.28, 3, 0xc8102e);
  line(x + w * 0.45, y + h * 0.28, x + w * 0.6, y + h * 0.52, 3, 0xc8102e);
  line(x + w * 0.6, y + h * 0.52, x + w * 0.75, y + h * 0.62, 3, 0xc8102e);
  line(x + w * 0.75, y + h * 0.62, x + w * 0.92, y + h * 0.82, 3, 0xc8102e);
  poly([[x + w * 0.88, y + h * 0.72], [x + w * 0.94, y + h * 0.86], [x + w * 0.82, y + h * 0.84]], 0xc8102e);
  rect(x + w * 0.06, y + h * 0.10, w * 0.30, h * 0.16, 0xc8102e);
  drawText(x + w * 0.08, y + h * 0.11, "-5.9%", "sansb:11", 0xffffff);
}
function sceneTalks(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, 0xd8cdb2);
  rect(x, y, w, h * 0.45, 0x8a9ab2); // window wall
  rect(x + w * 0.1, y + h * 0.08, w * 0.8, h * 0.32, 0xcfe0e8);
  line(x + w * 0.5, y + h * 0.08, x + w * 0.5, y + h * 0.40, 2, 0x8a9ab2);
  // table
  rect(x + w * 0.12, y + h * 0.62, w * 0.76, h * 0.08, 0x5a3a22);
  rect(x + w * 0.16, y + h * 0.70, w * 0.04, h * 0.22, 0x3a2412);
  rect(x + w * 0.80, y + h * 0.70, w * 0.04, h * 0.22, 0x3a2412);
  // chairs + people
  for (const cx of [0.22, 0.5, 0.78]) {
    circle(x + w * cx, y + h * 0.52, 6, 0x2a2a2a);
    rect(x + w * cx - 7, y + h * 0.56, 14, 8, 0x2a2a2a);
  }
  rect(x + w * 0.42, y + h * 0.58, w * 0.16, 4, 0xffffff); // papers
  flag(x + w * 0.06, y + h * 0.46, 18, 11, "UA");
  flag(x + w * 0.86, y + h * 0.46, 18, 11, "RU");
}
function sceneCartagena(x: number, y: number, w: number, h: number) {
  sky(x, y, w, h, 0x2a4a6a, 0x6a8aaa, 0xc8b88a);
  rect(x, y + h * 0.42, w, h * 0.58, 0x8a6a3a); // street
  rect(x, y + h * 0.10, w * 0.62, h * 0.40, 0x2a8a4a); // store
  rect(x + w * 0.05, y + h * 0.16, w * 0.52, h * 0.12, 0xffffff);
  drawText(x + w * 0.08, y + h * 0.17, "MARKET", "sansb:9", 0x2a8a4a);
  rect(x + w * 0.08, y + h * 0.32, w * 0.18, h * 0.18, 0x1a2a3a);
  rect(x + w * 0.32, y + h * 0.32, w * 0.18, h * 0.18, 0x1a2a3a);
  rect(x + w * 0.66, y + h * 0.12, w * 0.30, h * 0.38, 0xd8b88a); // building
  for (let i = 0; i < 3; i++) rect(x + w * (0.70 + i * 0.08), y + h * 0.18, w * 0.04, h * 0.10, 0x2a2a2a);
  // police car
  rect(x + w * 0.55, y + h * 0.62, w * 0.38, h * 0.16, 0xffffff);
  rect(x + w * 0.62, y + h * 0.54, w * 0.20, h * 0.10, 0xffffff);
  rect(x + w * 0.64, y + h * 0.56, w * 0.07, h * 0.06, 0x2a4fa2);
  rect(x + w * 0.73, y + h * 0.56, w * 0.07, h * 0.06, 0x2a4fa2);
  circle(x + w * 0.62, y + h * 0.80, 5, 0x111111); circle(x + w * 0.86, y + h * 0.80, 5, 0x111111);
  rect(x + w * 0.68, y + h * 0.50, w * 0.05, h * 0.04, 0xc8102e); rect(x + w * 0.74, y + h * 0.50, w * 0.05, h * 0.04, 0x2a4fa2);
  // tape
  line(x + w * 0.05, y + h * 0.88, x + w * 0.55, y + h * 0.82, 3, 0xffd800);
}
function sceneShanghai(x: number, y: number, w: number, h: number) {
  sky(x, y, w, h, 0x3a4a5a, 0x8a9aa8, 0xc8b898);
  rect(x, y + h * 0.72, w, h * 0.28, 0x2a2a2a);
  // towers
  rect(x + w * 0.06, y + h * 0.34, w * 0.12, h * 0.40, 0x4a4a4a);
  rect(x + w * 0.24, y + h * 0.18, w * 0.10, h * 0.56, 0x555555);
  circle(x + w * 0.29, y + h * 0.30, 8, 0x777777);
  circle(x + w * 0.29, y + h * 0.48, 6, 0x777777);
  line(x + w * 0.29, y + h * 0.18, x + w * 0.29, y + h * 0.08, 2, 0x555555);
  rect(x + w * 0.42, y + h * 0.42, w * 0.14, h * 0.32, 0x3a3a3a);
  rect(x + w * 0.62, y + h * 0.26, w * 0.12, h * 0.48, 0x4a4a4a);
  rect(x + w * 0.80, y + h * 0.46, w * 0.13, h * 0.28, 0x3a3a3a);
  // windows
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) rect(x + w * (0.08 + j * 0.04), y + h * (0.38 + i * 0.08), 3, 4, 0xffd800, 0.8);
  // red seal stamp
  rect(x + w * 0.68, y + h * 0.58, w * 0.20, h * 0.14, 0xc8102e);
  drawText(x + w * 0.70, y + h * 0.59, "PROBE", "sansb:9", 0xffffff);
}
function sceneSolomon(x: number, y: number, w: number, h: number) {
  sky(x, y, w, h, 0x6ab2d8, 0xa8d0e8, 0xffe8a8);
  circle(x + w * 0.80, y + h * 0.22, 10, 0xffd800);
  rect(x, y + h * 0.62, w, h * 0.38, 0x1d6a8a); // sea
  poly([[x + w * 0.05, y + h * 0.62], [x + w * 0.45, y + h * 0.62], [x + w * 0.25, y + h * 0.42]], 0x2a8a4a); // island
  poly([[x + w * 0.55, y + h * 0.62], [x + w * 0.95, y + h * 0.62], [x + w * 0.75, y + h * 0.48]], 0x3a9a5a);
  line(x + w * 0.25, y + h * 0.42, x + w * 0.25, y + h * 0.24, 2, 0x5a3a22);
  line(x + w * 0.25, y + h * 0.24, x + w * 0.15, y + h * 0.30, 2, 0x2a6a2a);
  line(x + w * 0.25, y + h * 0.24, x + w * 0.35, y + h * 0.30, 2, 0x2a6a2a);
  flag(x + w * 0.12, y + h * 0.30, 18, 11, "AU");
  flag(x + w * 0.68, y + h * 0.34, 18, 11, "SB");
  // handshake: two sleeves meeting
  line(x + w * 0.38, y + h * 0.72, x + w * 0.50, y + h * 0.68, 4, 0x2a4fa2);
  line(x + w * 0.62, y + h * 0.72, x + w * 0.50, y + h * 0.68, 4, 0x1e6b34);
  circle(x + w * 0.50, y + h * 0.68, 4, 0xe8b88a);
}
function sceneGaza(x: number, y: number, w: number, h: number) {
  sky(x, y, w, h, 0x2a2a3a, 0x6a5a4a, 0xc88a5a);
  rect(x, y + h * 0.70, w, h * 0.30, 0x222222);
  const blds: [number, number, number][] = [[0.04, 0.30, 0.42], [0.20, 0.22, 0.50], [0.38, 0.34, 0.38], [0.54, 0.26, 0.46], [0.70, 0.38, 0.34], [0.84, 0.30, 0.42]];
  for (const [bx, by, bh] of blds) rect(x + w * bx, y + h * by, w * 0.13, h * bh, 0x4a3a2a);
  for (const [bx, by] of [[0.06, 0.36], [0.22, 0.28], [0.56, 0.32], [0.72, 0.44]] as const) rect(x + w * bx, y + h * by, 4, 5, 0xffd800, 0.9);
  smoke(x + w * 0.60, y + h * 0.30, 8, 0x444444);
  circle(x + w * 0.60, y + h * 0.42, 4, 0xff8a2a);
  // ambulance
  rect(x + w * 0.08, y + h * 0.76, w * 0.26, h * 0.14, 0xffffff);
  rect(x + w * 0.16, y + h * 0.78, 8, 8, 0xc8102e);
  circle(x + w * 0.13, y + h * 0.91, 4, 0x111111); circle(x + w * 0.29, y + h * 0.91, 4, 0x111111);
}
function sceneHormuz(x: number, y: number, w: number, h: number) {
  sky(x, y, w, h, 0x3a6a8a, 0x8ab2c8, 0xd8c8a8);
  rect(x, y + h * 0.55, w, h * 0.45, 0x1d4a6a);
  for (let i = 0; i < 4; i++) hline(x + w * 0.1 * i, y + h * (0.65 + i * 0.08), w * 0.5, 1, 0x6a8aaa);
  // tanker
  poly([[x + w * 0.08, y + h * 0.58], [x + w * 0.62, y + h * 0.58], [x + w * 0.58, y + h * 0.74], [x + w * 0.12, y + h * 0.74]], 0x7a1a1a);
  rect(x + w * 0.14, y + h * 0.48, w * 0.10, h * 0.10, 0xb8542a);
  rect(x + w * 0.26, y + h * 0.48, w * 0.10, h * 0.10, 0x2a6f8a);
  rect(x + w * 0.38, y + h * 0.48, w * 0.10, h * 0.10, 0x8a8a2a);
  rect(x + w * 0.52, y + h * 0.44, w * 0.08, h * 0.14, 0xdddddd);
  // mine + burst
  circle(x + w * 0.80, y + h * 0.52, 6, 0x111111);
  for (let a = 0; a < 8; a++) line(x + w * 0.80, y + h * 0.52, x + w * 0.80 + Math.cos((a * Math.PI) / 4) * 10, y + h * 0.52 + Math.sin((a * Math.PI) / 4) * 10, 1, 0x111111);
  circle(x + w * 0.80, y + h * 0.38, 7, 0xff8a2a);
  circle(x + w * 0.80, y + h * 0.38, 4, 0xffd23a);
  smoke(x + w * 0.80, y + h * 0.30, 7, 0x444444);
}
function sceneHera(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, 0x050510);
  for (const [sx, sy, r] of [[0.08, 0.12, 1], [0.25, 0.06, 1], [0.5, 0.15, 1], [0.7, 0.08, 2], [0.88, 0.2, 1], [0.15, 0.4, 1], [0.92, 0.55, 1], [0.4, 0.3, 1]] as const) circle(x + w * sx, y + h * sy, r, 0xffffff);
  // Didymos (big) + Dimorphos (small)
  circle(x + w * 0.62, y + h * 0.58, 20, 0x8a8378);
  circle(x + w * 0.57, y + h * 0.52, 5, 0x6a6358); circle(x + w * 0.68, y + h * 0.64, 4, 0x6a6358); circle(x + w * 0.65, y + h * 0.50, 3, 0x7a7368);
  circle(x + w * 0.30, y + h * 0.40, 11, 0xa89f8c);
  circle(x + w * 0.27, y + h * 0.37, 3, 0x8a8172); circle(x + w * 0.33, y + h * 0.43, 2, 0x8a8172);
  // spacecraft
  rect(x + w * 0.10, y + h * 0.72, w * 0.16, h * 0.12, 0xd8d8d8);
  rect(x + w * 0.26, y + h * 0.74, w * 0.22, h * 0.08, 0x2a4fa2);
  rect(x + w * 0.02, y + h * 0.74, w * 0.08, h * 0.08, 0x2a4fa2);
  line(x + w * 0.18, y + h * 0.72, x + w * 0.30, y + h * 0.40, 1, 0xffffff);
  line(x + w * 0.62, y + h * 0.58, x + w * 0.72, y + h * 0.30, 1, 0xffd800);
}
function sceneWage(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, 0xe8ddc0);
  rect(x, y + h * 0.55, w, h * 0.45, 0x6a5a3a);
  rect(x + w * 0.08, y + h * 0.20, w * 0.84, h * 0.40, 0x8a2a2a); // factory
  poly([[x + w * 0.08, y + h * 0.20], [x + w * 0.50, y + h * 0.08], [x + w * 0.92, y + h * 0.20]], 0x5a1a1a);
  for (let i = 0; i < 4; i++) rect(x + w * (0.14 + i * 0.18), y + h * 0.30, w * 0.10, h * 0.14, 0xffd800, 0.9);
  // wage bars
  rect(x + w * 0.14, y + h * 0.68, w * 0.24, h * 0.12, 0x8a8a8a);
  rect(x + w * 0.58, y + h * 0.60, w * 0.24, h * 0.20, 0x1e6b34);
  drawText(x + w * 0.14, y + h * 0.62, "12,500", "sansb:9", 0xffffff);
  drawText(x + w * 0.58, y + h * 0.54, "17,000", "sansb:9", 0xffffff);
  line(x + w * 0.26, y + h * 0.68, x + w * 0.70, y + h * 0.60, 2, 0xc8102e);
}

// ---------- world map ----------
const CONTINENTS: [number, number][][] = [
  [[-168, 66], [-140, 70], [-120, 72], [-95, 80], [-80, 73], [-60, 60], [-55, 47], [-70, 42], [-75, 35], [-80, 25], [-85, 20], [-95, 18], [-105, 20], [-115, 30], [-125, 40], [-125, 49], [-145, 60], [-165, 60]],
  [[-80, 10], [-60, 8], [-50, 0], [-40, -5], [-35, -10], [-40, -20], [-50, -30], [-60, -35], [-70, -40], [-73, -50], [-70, -55], [-75, -40], [-80, -20], [-80, -5]],
  [[-10, 36], [-5, 44], [0, 46], [5, 53], [10, 57], [18, 56], [25, 60], [30, 70], [40, 68], [45, 60], [40, 50], [30, 45], [25, 40], [20, 40], [15, 44], [10, 44], [5, 43], [0, 40], [-5, 37]],
  [[-10, 35], [0, 35], [10, 37], [20, 32], [30, 31], [35, 28], [40, 15], [48, 11], [51, 10], [45, 0], [40, -10], [35, -20], [30, -30], [20, -35], [15, -30], [12, -18], [9, -5], [9, 4], [-8, 5], [-15, 12], [-17, 20], [-15, 30]],
  [[40, 68], [50, 70], [70, 72], [90, 75], [110, 76], [130, 72], [150, 70], [170, 66], [178, 65], [170, 60], [160, 55], [150, 50], [140, 45], [135, 40], [130, 35], [127, 35], [122, 30], [120, 25], [110, 20], [105, 10], [100, 8], [95, 15], [90, 22], [85, 20], [80, 15], [75, 10], [70, 20], [65, 25], [60, 25], [55, 26], [50, 29], [48, 30], [45, 30], [42, 35], [40, 40], [35, 36], [30, 36], [35, 42], [40, 45], [40, 55], [45, 60]],
  [[113, -22], [114, -30], [115, -35], [120, -34], [130, -32], [135, -35], [140, -38], [145, -38], [150, -37], [153, -32], [153, -27], [150, -22], [146, -19], [142, -15], [142, -11], [137, -12], [135, -15], [130, -13], [126, -14], [122, -17], [118, -20]],
  [[-45, 60], [-30, 65], [-25, 70], [-35, 75], [-55, 75], [-60, 70], [-55, 65]],
  [[-5, 50], [-3, 53], [-5, 56], [-3, 58], [-1, 57], [0, 53], [1, 51]],
  [[130, 31], [132, 33], [135, 34], [137, 35], [139, 38], [141, 41], [143, 43], [145, 44], [142, 42], [140, 39], [137, 37], [133, 35], [130, 33]],
  [[95, 5], [100, 0], [105, -5], [110, -7], [115, -8], [120, -10], [125, -9], [130, -5], [135, -3], [140, -5], [138, -8], [130, -8], [120, -10], [110, -8], [100, -5], [95, 0]],
  [[167, -45], [170, -42], [174, -39], [176, -37], [174, -41], [170, -44]],
];
function drawMap(x: number, y: number, w: number, h: number) {
  rect(x, y, w, h, SKY);
  frame(x, y, w, h, 2, INK);
  const lon2x = (lon: number) => x + ((lon + 180) / 360) * w;
  const lat2y = (lat: number) => y + ((75 - lat) / 130) * h;
  for (const cont of CONTINENTS) {
    poly(cont.map(([lo, la]) => [lon2x(lo), lat2y(la)] as [number, number]), 0xc9bd8f);
  }
  // pins: [story no, lon, lat]
  const pins: [number, number, number][] = [
    [1, 43, 15.5], [2, 100, 40], [3, 127, 37.5], [4, 54, 24], [5, -75, 10],
    [6, 121, 31], [7, 160, -9], [8, 34.5, 31.5], [9, 56, 26], [11, 90, 23.7],
  ];
  for (const [n, lo, la] of pins) {
    const cx = lon2x(lo), cy = lat2y(la);
    circle(cx, cy, 8, RED);
    circle(cx, cy, 8, INK); // ring via overwrite? draw red then smaller white number
    circle(cx, cy, 7, RED);
    drawText(cx - (n < 10 ? 2.5 : 5), cy - 5, String(n), "sansb:9", 0xffffff);
  }
  drawText(x + 6, y + h - 26, "WHERE IT HAPPENED — PINS = STORY NUMBERS", "sansb:9", NAVY);
  drawText(x + 6, y + h - 14, "ME 5 · EU 9 · AM 7 · AP 9 · AF 3 · OC 1 · SPACE 1", "sansb:9", NAVY);
}

// ---------- layout ----------
const M = 16, CW = 992;
function kicker(x: number, y: number, s: string, color = RED) {
  drawText(x, y, s, "sansb:11", color);
}
function sourceLine(x: number, y: number, s: string) {
  drawText(x, y, s, "sans:10", MUTED);
}
function badge(x: number, y: number, s: string, c: number) {
  const w = textWidth(s, "sansb:9") + 10;
  rect(x, y, w, 13, c);
  drawText(x + 5, y + 1, s, "sansb:9", 0xffffff);
  return w;
}
function card(x: number, y: number, w: number, n: number, region: string, scene: (x: number, y: number, w: number, h: number) => void, headline: string, caption: string, source: string) {
  scene(x, y, w, 52);
  frame(x, y, w, 52, 1, INK);
  drawText(x, y + 56, `${n} · ${region}`, "sansb:10", RED);
  const hl = wrap(headline, "bask:17", w).slice(0, 2).length;
  para(x, y + 68, headline, "bask:17", INK, w, 18, 2);
  const capY = y + 68 + hl * 18 + 4;
  para(x, capY, caption, "gel:11", INK, w, 12, 2);
  sourceLine(x, capY + 26, source);
}
function build() {
  fillAll(PAPER);
  // top bar
  drawText(M, 10, "THE WORLD IN ONE DAY", "sansb:13", NAVY);
  drawText(W - M, 11, "35 STORIES  ·  7 REGIONS  ·  ALL DATED", "sansb:11", INK, "r");
  hline(M, 30, CW, 3, INK);
  // masthead — the date is the biggest text on the page
  drawText(W / 2, 36, "Wednesday 25 November 2026", "bodoni:58", INK, "c");
  hline(M, 106, CW, 4, INK);
  hline(M, 113, CW, 1, INK);
  drawText(W / 2, 119, "Saudi-led strikes hit Hodeidah  ·  Shenzhou-24 lifts off  ·  Asia's AI stocks plunge", "baskit:14", RED, "c");
  // stat strip
  const stats: [string, string][] = [
    ["-5.9%", "KOSPI, SEOUL"], ["490,334", "RUSSIAN WAR DEAD"],
    ["$237.5B", "VENEZUELA DEBT"], ["26", "MINERS TRAPPED, BOGOR"],
    ["5-1", "REAL MADRID v PSV"], ["17,000 TK", "DHAKA MINIMUM WAGE"],
  ];
  const bw = (CW - 5 * 4) / 6;
  stats.forEach(([num, lab], i) => {
    const bx = M + i * (bw + 4);
    rect(bx, 140, bw, 40, CARD);
    frame(bx, 140, bw, 40, 1, INK);
    drawText(bx + bw / 2, 144, num, "bask:22", RED, "c");
    drawText(bx + bw / 2, 167, lab, "sansb:9", INK, "c");
  });
  hline(M, 186, CW, 2, INK);

  // HERO — 1 Hodeidah
  const hy = 192;
  sceneHodeidah(M, hy, 340, 152);
  frame(M, hy, 340, 152, 2, INK);
  const hx = M + 352;
  drawText(hx, hy + 2, "1  ·  YEMEN — MIDDLE EAST  ·  LEAD STORY", "sansb:11", RED);
  flag(hx, hy + 20, 26, 15, "YE");
  para(hx, hy + 40, "Saudi-led strikes hit Hodeidah port", "bask:30", INK, 640, 36, 2);
  para(hx, hy + 82, "Raids at dawn follow an evacuation order for the port, Yemen's main food lifeline. The Houthis threaten Jeddah and every Saudi Red Sea port.", "gel:12", INK, 640, 15, 3);
  sourceLine(hx, hy + 132, "SOURCES: REUTERS · AL JAZEERA · ANI — 25 NOV 2026");
  badge(hx + 420, hy + 130, "CONFIRMED", GREEN);
  hline(M, 350, CW, 2, INK);

  // ROW B — 2 Shenzhou, 3 AI stocks
  const by = 356;
  const bw2 = 488;
  for (const [bx, n, region, scene, head, cap, src] of [
    [M, "2", "JIUQUAN, CHINA — SPACE", sceneRocket, "Shenzhou-24 lifts off with Pakistan's first astronaut", "Zeeshan Ali is the first foreign visitor to Tiangong. Liftoff 00:18 UTC; docked 3.5 hours later.", "REUTERS · XINHUA — 25 NOV"],
    [M + bw2 + 16, "3", "ASIA — MARKETS", sceneStocks, "Asia's AI stocks plunge again", "Kospi -5.9%, Taiex -6%, Nikkei -2.9%. Samsung -9.1%, SK Hynix -9.8%, SoftBank -14.8%.", "AP · REUTERS — 25 NOV"],
  ] as const) {
    scene(bx, by, 190, 120);
    frame(bx, by, 190, 120, 1, INK);
    const tx = bx + 200;
    drawText(tx, by + 2, `${n} · ${region}`, "sansb:10", RED);
    para(tx, by + 18, head, "bask:17", INK, 288, 20, 3);
    para(tx, by + 78, cap, "gel:11", INK, 288, 13, 2);
    sourceLine(tx, by + 106, src);
  }
  hline(M, 482, CW, 2, INK);

  // ROW C — 4-7
  const cy = 488;
  const cw4 = 242;
  card(M, cy, cw4, 4, "UKRAINE — EUROPE", sceneTalks, "Abu Dhabi talks end in deadlock", "No breakthrough as Moscow holds its line on territory. Envoys fly on to Moscow.", "NEXUS EUROPA · AP — 25 NOV");
  card(M + 250, cy, cw4, 5, "COLOMBIA — AMERICAS", sceneCartagena, "All hostages freed in dawn raid", "Special forces storm the Exito store at 01:00. One gunman killed, four held.", "AFP · SKY NEWS — 25 NOV");
  card(M + 500, cy, cw4, 6, "CHINA — ASIA-PACIFIC", sceneShanghai, "Shanghai party chief probed", "Chen Jining is the fourth Politburo member to fall since 2025.", "REUTERS · XINHUA — 25 NOV");
  card(M + 750, cy, cw4, 7, "OCEANIA — DIPLOMACY", sceneSolomon, "Treaty puts Australia first", "Canberra signs a security pact with the Solomons. No foreign bases; China pact lapses.", "PM.GOV.AU · REUTERS — 25 NOV");

  // ROW D — 8-11
  const dy = 634;
  card(M, dy, cw4, 8, "GAZA — MIDDLE EAST", sceneGaza, "Strike kills four in Shati camp", "An apartment in Gaza City is hit before dawn. A family of four is reported dead.", "AL JAZEERA — 25 NOV");
  card(M + 250, dy, cw4, 9, "HORMUZ — MIDDLE EAST", sceneHormuz, "Two tankers hit mines, Iran says", "IRGC claims engine-room fires. Not independently verified; no names given.", "IRNA · MEHR — 25 NOV · CLAIM");
  card(M + 500, dy, cw4, 10, "SPACE — PLANETARY DEFENCE", sceneHera, "Hera shows Dimorphos up close", "ESA reveals the first close-ups of the asteroid NASA struck in 2022.", "BBC · ESA — 25 NOV");
  card(M + 750, dy, cw4, 11, "BANGLADESH — ASIA-PACIFIC", sceneWage, "Garment wage up 36% to 17,000 TK", "Board sets the floor after weeks of protests. Workers wanted 30,000 TK.", "REUTERS · AP · AFP — 25 NOV");
  hline(M, 780, CW, 2, INK);

  // ALSO header
  drawText(M, 786, "ALSO ON WEDNESDAY 25 NOVEMBER — 24 MORE STORIES", "sansb:13", INK);
  drawText(W - M, 787, "RED DATE = HAPPENED TUESDAY 24 NOV  ·  23 NOV = MONDAY", "sansb:10", RED, "r");

  // Map (left) + ALSO list (right)
  drawMap(M, 800, 300, 132);

  const also: [number, string, string, string][] = [
    [12, "NVIDIA", "Falls 5.9% as AI rally fades", "25 NOV"],
    [13, "HOUTHIS", "Threaten Jeddah, all Saudi ports", "25 NOV"],
    [14, "PUTIN", "Invites EU leaders to Moscow", "25 NOV"],
    [15, "ZELENSKY", "Rejects Lukashenko's escort offer", "25 NOV"],
    [16, "US ENVOYS", "Kushner, Witkoff reach Moscow", "25 NOV"],
    [17, "ZAPORIZHZHIA", "Strike kills 2, wounds 22", "25 NOV"],
    [18, "XI", "Urges stronger Party rule-building", "25 NOV"],
    [19, "HUAWEI", "Guilty on 10 of 12 counts", "24 NOV"],
    [20, "RIYADH", "Houthi drone hits tower; 11 hurt", "24 NOV"],
    [21, "SARKOZY", "Ordered to trial with Carla Bruni", "24 NOV"],
    [22, "BENGHAZI", "Two sailors die of wounds", "24 NOV"],
    [23, "REAL MADRID", "Rout PSV 5-1 from behind", "24 NOV"],
    [24, "SINGAPORE", "2026 growth forecast to ~6%", "24 NOV"],
    [25, "VENEZUELA", "Debt put at $237.5B", "24 NOV"],
    [26, "WHO", "Urges US to lift Cuba fuel blockade", "24 NOV"],
    [27, "WAR DEAD", "Russia's own data: 490,334 killed", "25 NOV"],
    [28, "WINDSOR", "Two arrested after royal break-in", "24 NOV"],
    [29, "SENEGAL", "AFCON 2025 title restored by CAS", "24 NOV"],
    [30, "MISS UNIVERSE", "Barreto wins in San Juan", "24 NOV"],
    [31, "TRUMP", "Pardons turkeys Freedom, Feathers", "24 NOV"],
    [32, "VILLAVICENCIO", "Car bomb wounds 23", "23 NOV"],
    [33, "EBOLA", "Fighting stalls Congo response", "25 NOV"],
    [34, "BOGOR", "26 miners trapped in flooded mine", "25 NOV"],
    [35, "US TARIFFS", "New duties set for 16 partners", "25 NOV"],
  ];
  const colX = [M + 316, M + 316 + 342];
  const colW = 334;
  const trunc = (s: string, spec: string, maxW: number): string => {
    if (textWidth(s, spec) <= maxW) return s;
    let t = s;
    while (t.length > 1 && textWidth(t + "…", spec) > maxW) t = t.slice(0, -1);
    return t + "…";
  };
  also.forEach(([n, lead, rest, date], i) => {
    const col = i < 12 ? 0 : 1;
    const row = i % 12;
    const x = colX[col], y = 800 + row * 12;
    const isOld = date !== "25 NOV";
    drawText(x, y, `${n} · `, "gelb:11", RED);
    const nw = textWidth(`${n} · `, "gelb:11");
    drawText(x + nw, y, lead + " — ", "gelb:11", INK);
    const lw = textWidth(lead + " — ", "gelb:11");
    const avail = colW - nw - lw - 46;
    drawText(x + nw + lw, y, trunc(rest, "gel:11", avail), "gel:11", INK);
    drawText(x + colW - 44, y, `(${date})`, "sansb:9", isOld ? RED : MUTED, "l");
  });

  // DATE CHECK strip
  rect(M, 950, CW, 38, 0xfff3e0);
  frame(M, 950, CW, 38, 2, RED);
  drawText(M + 8, 954, "DATE CHECK —", "sansb:11", RED);
  const dcX = M + 8 + textWidth("DATE CHECK — ", "sansb:11") + 4;
  para(dcX, 954, "Every story above is dated. Items marked 24 NOV happened Tuesday and were reported Wednesday; Villavicencio is marked 23 NOV. Left out on purpose: COP31 talks end without a deal (22 Nov) · GTA 6 released worldwide (19 Nov) · Cyclone Akvan landfall, Odisha (20 Nov).", "gel:11", INK, W - M - 8 - dcX, 13, 3);
  // footer
  drawText(W / 2, 994, "SOURCES: REUTERS · AP · AFP · BBC · XINHUA · AL JAZEERA · PM.GOV.AU · METI · WHO · DRAWN IN CODE — NO PHOTOS", "sans:10", MUTED, "c");
  hline(M, 1010, CW, 3, INK);
}

// ---------- PNG encode (RGB, filter 0) ----------
function encodePng(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    for (let x = 0; x < W; x++) {
      const s = (y * W + x) * 4, d = y * (1 + W * 3) + 1 + x * 3;
      raw[d] = buf[s]; raw[d + 1] = buf[s + 1]; raw[d + 2] = buf[s + 2];
    }
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function resolveOutputDir(): string {
  const env = process.env.MAKEFUN_OUTPUT_DIR;
  if (env) return env;
  if (fs.existsSync("/output")) return "/output";
  return path.join(process.cwd(), "output");
}

function main() {
  const here = path.dirname(new URL(import.meta.url).pathname);
  const cands = [path.join(here, "assets"), path.join(here, "..", "assets")];
  const assetDir = cands.find((d) => fs.existsSync(path.join(d, "atlas.json")));
  if (!assetDir) throw new Error("atlas.json not found next to main.ts/dist");
  loadAtlas(assetDir);
  build();
  const outDir = resolveOutputDir();
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "entry.png"), encodePng());
  console.log(`wrote ${path.join(outDir, "entry.png")}`);
}
main();
