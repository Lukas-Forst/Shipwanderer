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

let mx = 0;
for(let y=0; y<h-1; y++) {
  for(let x=0; x<w-1; x++) {
     const i1 = (y*w+x)*4;
     const i2 = (y*w+x+1)*4;
     const i3 = ((y+1)*w+x)*4;
     
     const d1 = Math.pow(data[i1]-data[i2],2)+Math.pow(data[i1+1]-data[i2+1],2)+Math.pow(data[i1+2]-data[i2+2],2);
     const d2 = Math.pow(data[i1]-data[i3],2)+Math.pow(data[i1+1]-data[i3+1],2)+Math.pow(data[i1+2]-data[i3+2],2);
     if(d1 > mx) mx = d1;
     if(d2 > mx) mx = d2;
  }
}
console.log("Max adjacent pixel jump in entire image:", mx);
