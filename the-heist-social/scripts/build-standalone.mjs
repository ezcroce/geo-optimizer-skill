import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

let html = await readFile('dist/index.html', 'utf8');
const scriptTag = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const styleTag = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);
if (!scriptTag || !styleTag) throw new Error('Vite output assets not found');
const asset = (url) => path.join('dist', url.replace(/^\//, ''));
const js = await readFile(asset(scriptTag[1]), 'utf8');
const css = await readFile(asset(styleTag[1]), 'utf8');
html = html.replace(scriptTag[0], '');
html = html.replace(styleTag[0], () => `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`);
html = html.replace('</body>', () => `<script type="module">\n${js.replace(/<\/script/gi, '<\\/script')}\n</script>\n</body>`);
await writeFile('play.html', html);
console.log(`Standalone play.html generated (${Buffer.byteLength(html)} bytes)`);
