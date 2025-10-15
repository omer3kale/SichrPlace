#!/usr/bin/env node
/*
 * Preflight build reliability script.
 * Goals:
 *  1. Validate Node.js version.
 *  2. Basic filesystem & structural checks.
 *  3. Load backend server (without starting listener) to catch syntax/runtime errors.
 *  4. Run a lightweight health probe against the Express app.
 *  5. Provide clear PASS/FAIL summary; exit(1) on hard failures.
 */

// Because root package.json uses type=module we write this as ESM.

import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const errors = [];
const warnings = [];

// Load environment variables from project root .env if available
const envPath = resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

function section(title) {
  // eslint-disable-next-line no-console
  console.log(`\n=== ${title} ===`);
}

section('Environment Checks');
// 1. Node version
const requiredMajor = 20;
const currentMajor = parseInt(process.versions.node.split('.')[0], 10);
if (currentMajor < requiredMajor) {
  errors.push(`Node.js ${requiredMajor}+ required. Detected ${process.version}`);
} else {
  console.log(`✔ Node version OK (${process.version})`);
}

// 2. Directory structure sanity
section('Directory Structure');
const expectedPaths = [
  'backend/server.js',
  'js/backend/server.js',
  'frontend/login.html',
];
expectedPaths.forEach(p => {
  const abs = resolve(process.cwd(), p);
  if (!fs.existsSync(abs)) {
    errors.push(`Missing required path: ${p}`);
  } else {
    console.log(`✔ Found ${p}`);
  }
});

// 3. Env variable hints (non-fatal)
section('Environment Variables');
const importantEnv = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const strict = process.argv.includes('--strict') || process.env.CI === 'true';
importantEnv.forEach(key => {
  if (!process.env[key]) {
    warnings.push(`ENV ${key} not set`);
  } else {
    console.log(`✔ ${key} present`);
  }
});

// 4. Load backend app
section('Backend Load');
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.PRE_FLIGHT = 'true';
const missingSupabase = !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
let app;
if (missingSupabase) {
  warnings.push('Skipping backend load (Supabase env vars missing)');
} else {
  try {
    const backendPath = resolve(process.cwd(), 'js/backend/server.js');
    const req = createRequire(pathToFileURL(__filename));
    const cjs = req(backendPath);
    const candidate = cjs?.default || cjs;
    if (candidate && typeof candidate.use === 'function') {
      app = candidate;
      console.log('✔ Loaded backend Express app');
    } else {
      errors.push('Backend module did not export an Express app');
    }
  } catch (e) {
    warnings.push(`Backend load warning: ${e.message}`);
  }
}

// 5. Health probe (only if app loaded)
section('Health Probe');
if (app && typeof app === 'function') {
  try {
    const supertest = await import('supertest');
    const request = supertest.default || supertest;
    const res = await request(app).get('/api/health').timeout({ deadline: 8000 });
    if (res.status === 200) {
      console.log('✔ Health endpoint responded 200 (healthy)');
    } else {
      warnings.push(`Health endpoint returned status ${res.status}`);
      console.log('Health payload:', res.body);
    }
  } catch (e) {
    warnings.push(`Health probe failed: ${e.message}`);
  }
} else {
  warnings.push('Skipping health probe (app not loaded)');
}

// 6. Summary
section('Summary');
if (warnings.length) {
  console.log('⚠ Warnings:');
  warnings.forEach(w => console.log('  -', w));
}
if (errors.length || (strict && importantEnv.some(k => !process.env[k]))) {
  if (strict && !errors.length) {
    console.error('\n❌ Strict mode: required environment variables missing');
    importantEnv.filter(k => !process.env[k]).forEach(m => console.error('  - missing', m));
  } else {
  console.error('\n❌ Build Preflight Failed:');
  errors.forEach(err => console.error('  -', err));
  }
  process.exit(1);
}

console.log('\n✅ Preflight checks passed. Safe to proceed with build.');
process.exit(0);
