#!/usr/bin/env node
/* Lightweight heuristic secret scanner (local use) */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const findings = [];
const patterns = [
  { name: 'Supabase service key', regex: /sb_secret_[A-Za-z0-9-_]{20,}/ },
  { name: 'JWT long base64', regex: /[A-Za-z0-9+/]{40,}={0,2}\.[A-Za-z0-9+/]{40,}={0,2}\.[A-Za-z0-9+/\-_]{20,}/ },
  { name: 'PayPal live key fragment', regex: /AcP[A-Za-z0-9]{20,}/ },
  { name: 'Potential Gmail app password', regex: /[a-z0-9]{16}/ },
];

function scanFile(file) {
  if (file.includes('node_modules') || file.includes('.git')) return;
  const stat = fs.statSync(file);
  if (stat.isDirectory()) {
    fs.readdirSync(file).forEach(f => scanFile(path.join(file, f)));
    return;
  }
  if (stat.size > 200000) return; // skip large files
  const content = fs.readFileSync(file, 'utf8');
  patterns.forEach(p => {
    const match = content.match(p.regex);
    if (match) {
      findings.push({ file: path.relative(ROOT, file), pattern: p.name, sample: match[0].slice(0, 60) });
    }
  });
}

scanFile(ROOT);

if (findings.length) {
  console.log('⚠ Potential secrets detected:');
  findings.forEach(f => console.log(` - [${f.pattern}] in ${f.file}: ${f.sample}...`));
  process.exitCode = 2;
} else {
  console.log('✅ No obvious secrets detected.');
}