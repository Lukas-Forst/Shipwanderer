const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const file = 'public/ship/tile001.png';
const img = new Image(); img.src = fs.readFileSync(file);
const w = img.width; const h = img.height;
const canvas = createCanvas(w, h); const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0); const data = ctx.getImageData(0, 0, w, h).data;

const bgPalette = [];
function addPalette(r, g, b) {
  for (const p of bgPalette) {
    if (Math.pow(p[0]-r,2)+Math.pow(p[1]-g,2)+Math.pow(p[2]-b,2) < 400) return;
  }
  bgPalette.push([r, g, b]);
}
const pts = [0, w-1, (h-1)*w, (h-1)*w+w-1, Math.floor(h/2)*w, Math.floor(h/2)*w+w-1, Math.floor(w/2), (h-1)*w+Math.floor(w/2)];
for (const pt of pts) addPalette(data[pt*4], data[pt*4+1], data[pt*4+2]);

const tolSq = 64 * 64;
function isBgColor(idx) {
  for (const p of bgPalette) {
    const dr = data[idx*4]-p[0], dg = data[idx*4+1]-p[1], db = data[idx*4+2]-p[2];
    if (dr*dr + dg*dg + db*db <= tolSq) return true;
  }
  return false;
}
const visited = new Uint8Array(w*h); const queue = new Int32Array(w*h); let qt = 0;
const push = (idx) => { if (!visited[idx]) { visited[idx]=1; queue[qt++]=idx; } };
for (let x = 0; x < w; x++) { push(x); push((h-1)*w+x); }
for (let y = 0; y < h; y++) { push(y*w); push(y*w+w-1); }

for (let qh = 0; qh < qt; qh++) {
  const idx = queue[qh]; const x = idx%w, y = Math.floor(idx/w);
  if (y>0) { const ni=idx-w; if(!visited[ni] && isBgColor(ni)) push(ni); }
  if (y<h-1){const ni=idx+w; if(!visited[ni] && isBgColor(ni)) push(ni); }
  if (x>0) { const ni=idx-1; if(!visited[ni] && isBgColor(ni)) push(ni); }
  if (x<w-1){const ni=idx+1; if(!visited[ni] && isBgColor(ni)) push(ni); }
}

let uncleared = 0;
for(let i=0; i<w*h; i++) if(!visited[i]) uncleared++;

console.log(`${file}: Uncleared pixels = ${uncleared} / ${w*h}`);
