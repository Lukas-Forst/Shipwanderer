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

let maxDiff = 0;
for (let y = 0; y < 10; y++) {
  for (let x = 0; x < 10 - 1; x++) {
     const i1 = (y * w + x) * 4;
     const i2 = (y * w + x + 1) * 4;
     const r = data[i1] - data[i2];
     const g = data[i1+1] - data[i2+1];
     const b = data[i1+2] - data[i2+2];
     const dist = r*r + g*g + b*b;
     if (dist > maxDiff) maxDiff = dist;
  }
}
console.log("Max diff in top-left 10x10 block is:", maxDiff);
