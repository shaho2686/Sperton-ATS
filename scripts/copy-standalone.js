const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const staticSrc = path.join(root, '.next', 'static');
const standaloneDest = path.join(root, '.next', 'standalone');
const standaloneStaticDest = path.join(standaloneDest, '.next');
const publicSrc = path.join(root, 'public');
const standalonePublicDest = path.join(standaloneDest, 'public');

if (!fs.existsSync(staticSrc)) {
  throw new Error('Missing .next/static. Did next build fail?');
}

if (!fs.existsSync(publicSrc)) {
  throw new Error('Missing public folder.');
}

fs.mkdirSync(standaloneStaticDest, { recursive: true });
fs.mkdirSync(standalonePublicDest, { recursive: true });
fs.cpSync(staticSrc, standaloneStaticDest, { recursive: true });
fs.cpSync(publicSrc, standalonePublicDest, { recursive: true });

console.log('Copied standalone assets successfully.');
