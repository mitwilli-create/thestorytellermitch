import fs from 'fs';
import path from 'path';

const SITE_URL = 'https://thestorytellermitch.com';
const EXCLUDES = [
  'ask-preview.html',
  'broll-pipeline.html', // redirected
  'build.html',
  'content-ops.html', // redirected
  'second-source 2.html',
  'throughline 2.html',
  'select-works.html'
];
const DIR = './';

const files = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));

let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

for (const file of files) {
  if (EXCLUDES.includes(file)) continue;
  if (file.startsWith('for-')) continue;
  
  let route = file === 'index.html' ? '' : file.replace('.html', '');
  xml += `  <url>\n    <loc>${SITE_URL}/${route}</loc>\n  </url>\n`;
}

xml += `</urlset>\n`;

fs.writeFileSync('sitemap.xml', xml);
console.log('sitemap.xml created');
