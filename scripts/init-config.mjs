import { access, copyFile } from 'node:fs/promises';

try {
  await access('config.js');
  console.log('config.js already exists. Edit this file and paste your Google Maps JavaScript API key.');
} catch {
  await copyFile('config.example.js', 'config.js');
  console.log('Created config.js. Open it and replace your_google_maps_api_key with your Google Maps JavaScript API key.');
}
