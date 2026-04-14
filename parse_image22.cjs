const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const file = 'public/ship/tile001.png';
const img = new Image(); img.src = fs.readFileSync(file);
const w = img.width; const h = img.height;
const canvas = createCanvas(w, h); const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0); const data = ctx.getImageData(0, 0, w, h).data;

const colorCounts = {};
for(let i=0; i<w*h; i++) {
  const c = `${data[i*4]},${data[i*4+1]},${data[i*4+2]}`;
  colorCounts[c] = (colorCounts[c] || 0) + 1;
}
const sorted = Object.entries(colorCounts).sort((a,b)=>b[1]-a[1]).slice(0, 20);
console.log("Top 20 colors in tile001:");
for(const [c, cnt] of sorted) console.log(`${c.padEnd(16)} : ${cnt}`);
