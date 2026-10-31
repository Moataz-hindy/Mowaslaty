import sharp from 'sharp';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve(process.argv[2] || 'resources/app-icon.png');
const image = await readFile(source);
const resize = size => sharp(image).resize(size, size, { fit: 'contain', background: '#ffffff' }).png().toBuffer();

for (const size of [16, 32]) await writeFile(`public/favicon-${size}.png`, await resize(size));
await writeFile('public/apple-touch-icon.png', await resize(180));

// PNG-backed ICO entries retain the supplied artwork at each browser size.
const sizes = [16, 32, 48];
const frames = await Promise.all(sizes.map(resize));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
frames.forEach((frame, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(frame.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += frame.length;
});
await writeFile('public/favicon.ico', Buffer.concat([header, ...frames]));
// Keep legacy direct SVG requests consistent with the new favicon as well.
const svgImage = (await resize(256)).toString('base64');
await writeFile('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><image width="256" height="256" href="data:image/png;base64,${svgImage}"/></svg>\n`);

const densities = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
for (const [density, scale] of densities) {
  const directory = `android/app/src/main/res/mipmap-${density}`;
  await mkdir(directory, { recursive: true });
  const legacy = await resize(Math.round(48 * scale));
  await writeFile(`${directory}/ic_launcher.png`, legacy);
  await writeFile(`${directory}/ic_launcher_round.png`, legacy);
  // Android's adaptive safe zone is the central 72dp of the 108dp layer.
  const canvas = Math.round(108 * scale);
  const artwork = Math.round(72 * scale);
  const inset = Math.round((canvas - artwork) / 2);
  const foreground = await sharp({ create: { width: canvas, height: canvas, channels: 4, background: '#ffffff' } })
    .composite([{ input: await resize(artwork), left: inset, top: inset }]).png().toBuffer();
  await writeFile(`${directory}/ic_launcher_foreground.png`, foreground);
}
console.log('Generated browser, Apple touch, legacy Android and adaptive Android icon assets.');
