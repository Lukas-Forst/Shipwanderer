const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const file = 'public/ship/tile001.png';
const img = new Image(); img.src = fs.readFileSync(file);
const w = img.width; const h = img.height;
const canvas = createCanvas(w, h); const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0); const data = ctx.getImageData(0, 0, w, h).data;

let count000 = 0;
for(let i=0; i<w*h; i++) {
  if(data[i*4]===0 && data[i*4+1]===0 && data[i*4+2]===0) {
     count000++;
  }
}
console.log("Count of 0,0,0 in tile001:", count000);
