import { access, copyFile } from 'node:fs/promises';

try {
  await access('config.js');
  console.log('config.js already exists. Edit this file and paste your Google Maps JavaScript API key and optional Supabase settings.');
} catch {
  await copyFile('config.example.js', 'config.js');
  console.log('Created config.js. Open it and set your Google Maps JavaScript API key and optional Supabase settings.');
}
