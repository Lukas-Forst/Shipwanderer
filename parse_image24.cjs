const fs = require('fs');
const { createCanvas, Image } = require('canvas');
const file = 'public/ship/tile001.png';
const img = new Image(); img.src = fs.readFileSync(file);
const w = img.width; const h = img.height;
const canvas = createCanvas(w, h); const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0); const data = ctx.getImageData(0, 0, w, h).data;
const pts = [
  0, w - 1, (h - 1) * w, (h - 1) * w + w - 1,
  ((h / 2) | 0) * w, ((h / 2) | 0) * w + w - 1,
  (w / 2) | 0, (h - 1) * w + ((w / 2) | 0)
];
for(const pt of pts) console.log(`${pt}: ${data[pt*4]},${data[pt*4+1]},${data[pt*4+2]}`);
