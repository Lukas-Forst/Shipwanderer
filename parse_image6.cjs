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

function colorDistSqOrigin(data, targetIdx) {
  const dr = data[targetIdx * 4] - data[0];
  const dg = data[targetIdx * 4 + 1] - data[1];
  const db = data[targetIdx * 4 + 2] - data[2];
  return dr * dr + dg * dg + db * db;
}

let sumDist = 0;
let mxDist = 0;
for(let i = 0; i<w*h; i++) {
  const d = colorDistSqOrigin(data, i);
  if (d > mxDist) mxDist = d;
}
console.log("Max distance from 0,0 is", mxDist);

// Now try flood fill with origin color
const tolSq = 100 * 100;
const visited = new Uint8Array(w * h);
const queue = new Int32Array(w * h);
let qt = 0;
const push = (idx) => { if (visited[idx]) return; visited[idx] = 1; queue[qt++] = idx; };

for (let x = 0; x < w; x += 1) { push(x); push((h - 1) * w + x); }
for (let y = 0; y < h; y += 1) { push(y * w); push(y * w + (w - 1)); }

for (let qh = 0; qh < qt; qh += 1) {
  const idx = queue[qh];
  const x = idx % w;
  const y = Math.floor(idx / w);
  if (y > 0) { const ni = idx - w; if (!visited[ni] && colorDistSqOrigin(data, ni) <= tolSq) push(ni); }
  if (y < h - 1) { const ni = idx + w; if (!visited[ni] && colorDistSqOrigin(data, ni) <= tolSq) push(ni); }
  if (x > 0) { const ni = idx - 1; if (!visited[ni] && colorDistSqOrigin(data, ni) <= tolSq) push(ni); }
  if (x < w - 1) { const ni = idx + 1; if (!visited[ni] && colorDistSqOrigin(data, ni) <= tolSq) push(ni); }
}

let cleared = 0;
for (let i = 0; i < w * h; i++) { if (visited[i]) cleared++; }
console.log("Flood fill with origin color max diff 100:", cleared, "of", w*h);

