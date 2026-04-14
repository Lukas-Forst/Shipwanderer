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

console.log(`Top-left (0,0): ${data[0]},${data[1]},${data[2]}`);
console.log(`Mid-left (0,h/2): ${data[(Math.floor(h/2)*w)*4]},${data[(Math.floor(h/2)*w)*4+1]},${data[(Math.floor(h/2)*w)*4+2]}`);
console.log(`Bottom-left (0,h-1): ${data[((h-1)*w)*4]},${data[((h-1)*w)*4+1]},${data[((h-1)*w)*4+2]}`);
console.log(`Mid-top (w/2,0): ${data[(Math.floor(w/2))*4]},${data[(Math.floor(w/2))*4+1]},${data[(Math.floor(w/2))*4+2]}`);
console.log(`Center (w/2,h/2): ${data[(Math.floor(h/2)*w + Math.floor(w/2))*4]},${data[(Math.floor(h/2)*w + Math.floor(w/2))*4+1]},${data[(Math.floor(h/2)*w + Math.floor(w/2))*4+2]}`);
