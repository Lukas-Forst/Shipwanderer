const fs = require('fs');
const { createCanvas, Image } = require('canvas');

const img = new Image();
img.src = fs.readFileSync('public/ship/tile000.png');
const canvas = createCanvas(img.width, img.height);
const ctx = canvas.getContext('2d');
ctx.drawImage(img, 0, 0);
const imgData = ctx.getImageData(0, 0, img.width, img.height);
const data = imgData.data;

console.log("Corner pixel:", data[0], data[1], data[2], data[3]);
console.log("Another edge pixel:", data[4], data[5], data[6], data[7]);
