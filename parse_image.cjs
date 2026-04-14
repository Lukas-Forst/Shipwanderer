const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const img = new Image();
img.src = fs.readFileSync('public/ship/tile000.png');
const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const imgData = ctx.getImageData(0, 0, img.width, img.height);
const data = imgData.data;

let minAlpha = 255;
for (let i = 3; i < data.length; i+=4) {
    if (data[i] < minAlpha) minAlpha = data[i];
}
console.log("Min alpha is", minAlpha);
