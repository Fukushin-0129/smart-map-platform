import { mkdir, rm, writeFile, copyFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const distDir = 'dist';
const filesToCopy = ['index.html', 'src/main.js', 'src/styles.css'];
const googleMapsApiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || '';

await rm(distDir, { recursive: true, force: true });

for (const file of filesToCopy) {
  const destination = join(distDir, file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(file, destination);
}


await writeFile(
  join(distDir, 'config.js'),
  `window.SMART_MAP_GOOGLE_MAPS_API_KEY = '${escapeJavaScript(googleMapsApiKey)}';\n`,
);

console.log('Built static site in dist/.');

function escapeJavaScript(value) {
  return String(value).replace(/[\\'\n\r\u2028\u2029]/g, (character) => {
    const escapes = {
      '\\': '\\\\',
      "'": "\\'",
      '\n': '\\n',
      '\r': '\\r',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029',
    };
    return escapes[character] || character;
  });
}
