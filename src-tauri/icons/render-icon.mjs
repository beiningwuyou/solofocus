import { createRequire } from "module";
import { readFileSync, mkdirSync, existsSync, rmSync, writeFileSync } from "fs";

const require = createRequire(import.meta.url);
let sharp;
try {
  sharp = (await import("sharp")).default;
} catch {
  try {
    sharp = require("sharp");
  } catch {
    console.warn("sharp is not installed. To render icons, install sharp: pnpm add -D sharp");
    process.exit(0);
  }
}

const ICONS_DIR = decodeURIComponent(new URL(".", import.meta.url).pathname);
const svg = readFileSync(ICONS_DIR + "app-icon.svg");

const sizes = [
  { name: "icon_16x16", size: 16 },
  { name: "icon_32x32", size: 32 },
  { name: "icon_128x128", size: 128 },
  { name: "icon_256x256", size: 256 },
  { name: "icon_512x512", size: 512 },
  { name: "icon_32x32@2x", size: 64 },
  { name: "icon_128x128@2x", size: 256 },
  { name: "icon_256x256@2x", size: 512 },
  { name: "icon_512x512@2x", size: 1024 },
];

const iconset = ICONS_DIR + "AppIcon.iconset";
if (existsSync(iconset)) rmSync(iconset, { recursive: true });
mkdirSync(iconset, { recursive: true });

for (const { name, size } of sizes) {
  const buf = await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  writeFileSync(`${iconset}/${name}.png`, buf);
  console.log(`rendered ${name} (${size}px)`);
}

const flat = [
  { file: "32x32.png", size: 32 },
  { file: "128x128.png", size: 128 },
  { file: "128x128@2x.png", size: 256 },
  { file: "tray-icon.png", size: 64 },
];
for (const { file, size } of flat) {
  await sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(ICONS_DIR + file);
  console.log(`rendered ${file}`);
}

// 1024 master (for icns + ico)
await sharp(svg, { density: 384 })
  .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(ICONS_DIR + "icon_1024.png");

// Build .ico (single high-res layer fallback; installers accept it)
await sharp(svg, { density: 384 })
  .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(ICONS_DIR + "icon.ico");
console.log("wrote icon.ico");

console.log("DONE_PNG");
