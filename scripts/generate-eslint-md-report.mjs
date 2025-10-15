#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const inputFiles = [
  { label: 'netlify/functions', path: path.resolve('tmp/eslint-netlify.json') },
  { label: 'scripts', path: path.resolve('tmp/eslint-scripts.json') },
  { label: 'organized/js', path: path.resolve('tmp/eslint-organized.json') }
];

const cwd = process.cwd();
const fileSummaries = new Map();
let totalErrors = 0;
let totalWarnings = 0;
const ruleCounts = new Map();

for (const { label, path: filePath } of inputFiles) {
  if (!fs.existsSync(filePath)) {
    console.warn(`Skipping ${label} – report not found at ${filePath}`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) {
    console.warn(`Skipping ${label} – report was empty`);
    continue;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    console.error(`Failed to parse JSON from ${filePath}:`, error);
    process.exitCode = 1;
    continue;
  }

  for (const entry of parsed) {
    const relativePath = path.relative(cwd, entry.filePath || '').replace(/\\/g, '/');
    if (!relativePath) {
      continue;
    }

    const existing = fileSummaries.get(relativePath) || {
      label,
      errors: 0,
      warnings: 0,
      messages: []
    };

    for (const message of entry.messages) {
      const severity = message.severity === 2 ? 'error' : 'warning';
      if (severity === 'error') {
        totalErrors += 1;
        existing.errors += 1;
      } else {
        totalWarnings += 1;
        existing.warnings += 1;
      }

      const ruleId = message.ruleId || 'n/a';
      const ruleStat = ruleCounts.get(ruleId) || { ruleId, errors: 0, warnings: 0 };
      if (severity === 'error') {
        ruleStat.errors += 1;
      } else {
        ruleStat.warnings += 1;
      }
      ruleCounts.set(ruleId, ruleStat);

      existing.messages.push({
        line: message.line,
        column: message.column,
        severity,
        message: message.message,
        ruleId
      });
    }

    fileSummaries.set(relativePath, existing);
  }
}

if (fileSummaries.size === 0) {
  console.error('No ESLint findings were captured. Did the JSON reports generate correctly?');
  process.exit(1);
}

const topFiles = Array.from(fileSummaries.entries())
  .map(([filePath, summary]) => ({
    filePath,
    errors: summary.errors,
    warnings: summary.warnings,
    total: summary.errors + summary.warnings
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 15);

const topRules = Array.from(ruleCounts.values())
  .map((rule) => ({
    ruleId: rule.ruleId,
    errors: rule.errors,
    warnings: rule.warnings,
    total: rule.errors + rule.warnings
  }))
  .sort((a, b) => b.total - a.total)
  .slice(0, 15);

const lines = [];
const now = new Date();

lines.push('# ESLint ESM Audit Report');
lines.push('');
lines.push(`Generated on ${now.toISOString()} using \`npx eslint\``);
lines.push('');
lines.push('## Summary');
lines.push('');
lines.push(`- Total files with findings: **${fileSummaries.size}**`);
lines.push(`- Total errors: **${totalErrors}**`);
lines.push(`- Total warnings: **${totalWarnings}**`);
lines.push('');

if (topFiles.length) {
  lines.push('### Top Files by Finding Count');
  lines.push('');
  lines.push('| File | Errors | Warnings | Total |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const file of topFiles) {
    lines.push(`| \`${file.filePath}\` | ${file.errors} | ${file.warnings} | ${file.total} |`);
  }
  lines.push('');
}

if (topRules.length) {
  lines.push('### Most Frequent Rules');
  lines.push('');
  lines.push('| Rule | Errors | Warnings | Total |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const rule of topRules) {
    lines.push(`| ${rule.ruleId} | ${rule.errors} | ${rule.warnings} | ${rule.total} |`);
  }
  lines.push('');
}

lines.push('## Detailed Findings');
lines.push('');

const sortedFiles = Array.from(fileSummaries.entries()).sort((a, b) => {
  const totalA = a[1].errors + a[1].warnings;
  const totalB = b[1].errors + b[1].warnings;
  if (totalA === totalB) {
    return a[0].localeCompare(b[0]);
  }
  return totalB - totalA;
});

for (const [filePath, summary] of sortedFiles) {
  lines.push(`### ${filePath}`);
  lines.push('');
  lines.push(`- Errors: **${summary.errors}**, Warnings: **${summary.warnings}**`);
  lines.push('');
  lines.push('| Line | Column | Severity | Rule | Message |');
  lines.push('| ---: | ---: | --- | --- | --- |');
  for (const message of summary.messages) {
    const escapedMessage = message.message.replace(/\|/g, '\\|');
    lines.push(`| ${message.line} | ${message.column} | ${message.severity} | ${message.ruleId} | ${escapedMessage} |`);
  }
  lines.push('');
}

const outputPath = path.resolve('docs/ESLINT_ESM_AUDIT.md');
fs.writeFileSync(outputPath, lines.join('\n'), 'utf8');
console.log(`Report written to ${outputPath}`);
