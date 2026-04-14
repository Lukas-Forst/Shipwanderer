const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const file = 'public/ship/tile000.png';
const img = new Image(); img.src = fs.readFileSync(file);
const w = img.width; const h = img.height;
const canvas = createCanvas(w, h); const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0); const data = ctx.getImageData(0, 0, w, h).data;

const tolSq = 22 * 22;
function colorDistSq(targetIdx, bgR, bgG, bgB) {
  const to = targetIdx * 4;
  const dr = data[to] - bgR; const dg = data[to+1] - bgG; const db = data[to+2] - bgB;
  return dr*dr + dg*dg + db*db;
}

const visited = new Uint8Array(w * h);
const queue = new Int32Array(w * h);
let qt = 0;

const push = (idx) => {
  if (visited[idx]) return;
  visited[idx] = 1; queue[qt++] = idx;
};

// Push borders
for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }

// Determine dominant background color by scanning borders
let bgR=0, bgG=0, bgB=0;
const borderColors = {};
for(let i=0; i<qt; i++) {
  const idx = queue[i];
  const c = `${data[idx*4]},${data[idx*4+1]},${data[idx*4+2]}`;
  borderColors[c] = (borderColors[c] || 0) + 1;
}
let maxCount = 0;
for(const [c, cnt] of Object.entries(borderColors)) {
  if(cnt > maxCount) {
    maxCount = cnt;
    const [r,g,b] = c.split(',').map(Number);
    bgR = r; bgG = g; bgB = b;
  }
}
console.log("Dominant border color:", bgR, bgG, bgB);

for (let qh = 0; qh < qt; qh++) {
  const idx = queue[qh];
  const x = idx % w; const y = (idx / w) | 0;
  if(y > 0) { const ni = idx - w; if(!visited[ni] && colorDistSq(ni, bgR, bgG, bgB) <= tolSq) push(ni); }
  if(y < h-1) { const ni = idx + w; if(!visited[ni] && colorDistSq(ni, bgR, bgG, bgB) <= tolSq) push(ni); }
  if(x > 0) { const ni = idx - 1; if(!visited[ni] && colorDistSq(ni, bgR, bgG, bgB) <= tolSq) push(ni); }
  if(x < w-1) { const ni = idx + 1; if(!visited[ni] && colorDistSq(ni, bgR, bgG, bgB) <= tolSq) push(ni); }
}

let cleared = 0;
for(let i=0; i<w*h; i++) if(visited[i]) cleared++;
console.log(`Cleared with origin comparison to dominant border = ${cleared}/${w*h}`);
