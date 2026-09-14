import { createRequire } from "module";
import { readFileSync, writeFileSync } from "fs";

const require = createRequire(import.meta.url);
const ICONS_DIR = process.cwd() + "/";

const sizes = [16, 32, 48, 64, 128, 256];
// pick the best available rendered png for each size
function pngFor(size) {
  const map = {
    16: "icon_16x16.png",
    32: "icon_32x32.png",
    48: "icon_32x32@2x.png", // 64
    64: "icon_32x32@2x.png",
    128: "icon_128x128.png",
    256: "icon_128x128@2x.png",
  };
  return readFileSync(ICONS_DIR + "AppIcon.iconset/" + map[size]);
}

const entries = sizes.map((s) => ({ size: s, data: pngFor(s) }));
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type 1 = icon
header.writeUInt16LE(entries.length, 4);

let offset = 6 + entries.length * 16;
const dir = [];
const blobs = [];
for (const e of entries) {
  const d = e.data;
  const de = Buffer.alloc(16);
  de.writeUInt8(e.size === 256 ? 0 : e.size, 0); // width (0 means 256)
  de.writeUInt8(e.size === 256 ? 0 : e.size, 1); // height
  de.writeUInt8(0, 2); // colors
  de.writeUInt8(0, 3); // reserved
  de.writeUInt16LE(1, 4); // planes
  de.writeUInt16LE(32, 6); // bit count
  de.writeUInt32LE(d.length, 8); // data size
  de.writeUInt32LE(offset, 12); // data offset
  dir.push(de);
  blobs.push(d);
  offset += d.length;
}

const out = Buffer.concat([header, ...dir, ...blobs]);
writeFileSync(ICONS_DIR + "icon.ico", out);
console.log("wrote multi-size icon.ico (" + entries.length + " layers)");
