const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const img = new Image();
img.src = fs.readFileSync('public/ship/tile000.png');
const w = img.width;
const h = img.height;
const canvas = createCanvas(w, h);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const imgData = ctx.getImageData(0, 0, w, h);
const data = imgData.data;

function colorDistSq(data, ia, ib) {
  const ao = ia * 4;
  const bo = ib * 4;
  const dr = data[ao] - data[bo];
  const dg = data[ao + 1] - data[bo + 1];
  const db = data[ao + 2] - data[bo + 2];
  return dr * dr + dg * dg + db * db;
}

const EDGE_FLOOD_COLOR_STEP = 22;
const tolSq = EDGE_FLOOD_COLOR_STEP * EDGE_FLOOD_COLOR_STEP;
const n = w * h;
const visited = new Uint8Array(n);
const queue = new Int32Array(n);
let qt = 0;

const push = (idx) => {
  if (visited[idx]) return;
  visited[idx] = 1;
  queue[qt++] = idx;
};

for (let x = 0; x < w; x += 1) { push(x); push((h - 1) * w + x); }
for (let y = 0; y < h; y += 1) { push(y * w); push(y * w + (w - 1)); }

for (let qh = 0; qh < qt; qh += 1) {
  const idx = queue[qh];
  const x = idx % w;
  const y = Math.floor(idx / w);
  if (y > 0) {
    const ni = idx - w;
    if (!visited[ni] && colorDistSq(data, idx, ni) <= tolSq) push(ni);
  }
  if (y < h - 1) {
    const ni = idx + w;
    if (!visited[ni] && colorDistSq(data, idx, ni) <= tolSq) push(ni);
  }
  if (x > 0) {
    const ni = idx - 1;
    if (!visited[ni] && colorDistSq(data, idx, ni) <= tolSq) push(ni);
  }
  if (x < w - 1) {
    const ni = idx + 1;
    if (!visited[ni] && colorDistSq(data, idx, ni) <= tolSq) push(ni);
  }
}

// target a 40x40 console grid
const aspect = w / h;
const gw = 60;
const gh = Math.floor(60 / aspect);
for (let y = 0; y < gh; y++) {
  let rowStr = '';
  for (let x = 0; x < gw; x++) {
    // sample center of block
    const sx = Math.floor((x + 0.5) * w / gw);
    const sy = Math.floor((y + 0.5) * h / gh);
    const v = visited[sy * w + sx];
    rowStr += v ? '.' : 'X';
  }
  console.log(rowStr);
}
