import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const functionsDir = path.join(path.resolve(scriptDir, '..'), 'netlify', 'functions');

const tablePattern = /\.from\('([a-zA-Z_]+)'\)/g;
const tables = new Set();

function walk(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      let match;
      while ((match = tablePattern.exec(content)) !== null) {
        tables.add(match[1]);
      }
    }
  }
}

walk(functionsDir);

console.log(Array.from(tables).sort().join('\n'));
