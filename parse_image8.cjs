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

let startX = w/2;
for(let x=0; x<w/2; x++) {
  const idx = ((h/2) * w + x) * 4;
  if(data[idx] !== data[0] || data[idx+1] !== data[1] || data[idx+2] !== data[2]) {
     console.log(`Mismatch at x=${x}: (${data[idx]},${data[idx+1]},${data[idx+2]}) vs origin (${data[0]},${data[1]},${data[2]})`);
     break;
  }
}
