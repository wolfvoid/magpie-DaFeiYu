import { copyFileSync, readFileSync, writeFileSync } from 'node:fs';
import { parse } from 'jsonc-parser';

const source = parse(readFileSync(new URL('../assets/upstream-config.jsonc', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../assets/upstream.json', import.meta.url), 'utf8'));
const names = manifest.files.map(entry => entry.name.replace(/\.webm$/, ''));
const config = {
  names,
  idle: source.animations.idle,
  clicks: source.animations.clicks,
  categories: source.animations.categories,
  states: {
    thinking: ['工作状态-思考冒泡', '深度思考碎碎念'],
    working: ['写代码', '工作状态-忙碌点按'],
    result: ['工作状态-清点归档', '轻快记录'],
    waiting: ['工作状态-原地踱步张望'],
    success: ['放烟花', '工作状态-雀跃庆祝'],
    error: ['工作状态-垂头叹气冒汗'],
  },
};
for (const name of [...config.idle, ...config.clicks, ...Object.values(config.states).flat(), ...config.categories.flatMap(category => category.actions)]) {
  if (!names.includes(name)) throw new Error(`Missing animation: ${name}`);
}
writeFileSync(new URL('../assets/catalog.json', import.meta.url), JSON.stringify(config, null, 2));
// ICO can wrap the existing PNG losslessly, keeping one shared source icon.
const png = readFileSync(new URL('../magpie/icon.png', import.meta.url));
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
if (width > 256 || height > 256) throw new Error('The shared icon must be at most 256 x 256 pixels.');
const ico = Buffer.alloc(22);
ico.writeUInt16LE(1, 2);
ico.writeUInt16LE(1, 4);
ico[6] = width % 256;
ico[7] = height % 256;
ico.writeUInt16LE(1, 10);
ico.writeUInt16LE(32, 12);
ico.writeUInt32LE(png.length, 14);
ico.writeUInt32LE(22, 18);
writeFileSync(new URL('../assets/app-icon.ico', import.meta.url), Buffer.concat([ico, png]));
copyFileSync(new URL('../magpie/icon.png', import.meta.url), new URL('../assets/tray-icon.png', import.meta.url));
console.log(`Prepared ${names.length} animation entries.`);
