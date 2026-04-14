const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const img0 = new Image(); img0.src = fs.readFileSync('public/ship/tile000.png');
const img1 = new Image(); img1.src = fs.readFileSync('public/ship/tile001.png');
const img10= new Image(); img10.src= fs.readFileSync('public/ship/tile010.png');

const w = img0.width; const h = img0.height;
const c0 = createCanvas(w, h); const ctx0 = c0.getContext('2d'); ctx0.drawImage(img0, 0, 0); const d0 = ctx0.getImageData(0, 0, w, h).data;
const c1 = createCanvas(w, h); const ctx1 = c1.getContext('2d'); ctx1.drawImage(img1, 0, 0); const d1 = ctx1.getImageData(0, 0, w, h).data;
const c10= createCanvas(w, h); const ctx10= c10.getContext('2d'); ctx10.drawImage(img10,0, 0); const d10= ctx10.getImageData(0, 0, w, h).data;

console.log("tile000 top-left:", d0[0], d0[1], d0[2], " | mid-left:", d0[(Math.floor(h/2)*w)*4], d0[(Math.floor(h/2)*w)*4+1], d0[(Math.floor(h/2)*w)*4+2]);
console.log("tile001 top-left:", d1[0], d1[1], d1[2], " | mid-left:", d1[(Math.floor(h/2)*w)*4], d1[(Math.floor(h/2)*w)*4+1], d1[(Math.floor(h/2)*w)*4+2]);
console.log("tile010 top-left:", d10[0], d10[1], d10[2], " | mid-left:", d10[(Math.floor(h/2)*w)*4], d10[(Math.floor(h/2)*w)*4+1], d10[(Math.floor(h/2)*w)*4+2]);

