const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const img = new Image();
img.src = fs.readFileSync('public/ship/tile000.png');
const w = img.width;
const h = img.height;
const canvas = createCanvas(w, h);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const data = ctx.getImageData(0, 0, w, h).data;

const bgPalette = [];
function addPalette(r, g, b) {
  for (const p of bgPalette) {
    const dr = p[0] - r; const dg = p[1] - g; const db = p[2] - b;
    if (dr * dr + dg * dg + db * db < 400) return;
  }
  bgPalette.push([r, g, b]);
}

const pts = [
  0, w - 1, (h - 1) * w, (h - 1) * w + w - 1,
  ((h / 2) | 0) * w, ((h / 2) | 0) * w + w - 1,
  (w / 2) | 0, (h - 1) * w + ((w / 2) | 0)
];
for (const pt of pts) {
  addPalette(data[pt * 4], data[pt * 4 + 1], data[pt * 4 + 2]);
}

const tolSq = 64 * 64;

function isBgColor(idx) {
  for (const p of bgPalette) {
    const dr = data[idx * 4] - p[0];
    const dg = data[idx * 4 + 1] - p[1];
    const db = data[idx * 4 + 2] - p[2];
    if (dr * dr + dg * dg + db * db <= tolSq) return true;
  }
  return false;
}

const n = w * h;
const visited = new Uint8Array(n);
const queue = new Int32Array(n);
let qt = 0;
const push = (idx) => { if (visited[idx]) return; visited[idx] = 1; queue[qt++] = idx; };

for (let x = 0; x < w; x += 1) { push(x); push((h - 1) * w + x); }
for (let y = 0; y < h; y += 1) { push(y * w); push(y * w + (w - 1)); }

for (let qh = 0; qh < qt; qh += 1) {
  const idx = queue[qh];
  const x = idx % w;
  const y = (idx / w) | 0;
  if (y > 0) { const ni = idx - w; if (!visited[ni] && isBgColor(ni)) push(ni); }
  if (y < h - 1) { const ni = idx + w; if (!visited[ni] && isBgColor(ni)) push(ni); }
  if (x > 0) { const ni = idx - 1; if (!visited[ni] && isBgColor(ni)) push(ni); }
  if (x < w - 1) { const ni = idx + 1; if (!visited[ni] && isBgColor(ni)) push(ni); }
}

for (let i = 0; i < n; i++) {
  if (visited[i]) data[i * 4 + 3] = 0;
}

// Dump the uncleared pixels to see WHAT they are!
let unclearedCount = 0;
const colorCounts = {};
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const i = (y * w + x);
    if (!visited[i]) {
      unclearedCount++;
      const c = `${data[i*4]},${data[i*4+1]},${data[i*4+2]}`;
      colorCounts[c] = (colorCounts[c] || 0) + 1;
    }
  }
}

console.log("Uncleared pixels count:", unclearedCount);
const sortedColors = Object.entries(colorCounts).sort((a,b)=>b[1]-a[1]).slice(0,10);
console.log("Top 10 Uncleared colors:", sortedColors);
