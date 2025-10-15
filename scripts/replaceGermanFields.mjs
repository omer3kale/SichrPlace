import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, '..');

const targetDirectories = [
  path.join(workspaceRoot, 'netlify', 'functions'),
  path.join(workspaceRoot, 'js', 'functions'),
  path.join(workspaceRoot, 'js', 'backend')
];

const replacements = [
  // Relationship identifiers first to avoid partial replacements
  { pattern: /users!apartments_vermieter_id_fkey/g, replacement: 'users!apartments_owner_id_fkey' },
  { pattern: /apartments_vermieter_id_fkey/g, replacement: 'apartments_owner_id_fkey' },
  { pattern: /bookings_vermieter_id_fkey/g, replacement: 'bookings_landlord_id_fkey' },
  { pattern: /users!bookings_vermieter_id_fkey/g, replacement: 'users!bookings_landlord_id_fkey' },

  // Column aliases
  { pattern: /\bvermieter_id\b/g, replacement: 'landlord_id' },
  { pattern: /\bmieter_id\b/g, replacement: 'requester_id' },
  { pattern: /\bvermieter_role\b/g, replacement: 'landlord_role' },
  { pattern: /\bmieter_role\b/g, replacement: 'applicant_role' },
  { pattern: /\bvermieter_email\b/g, replacement: 'landlord_email' },
  { pattern: /\bmieter_email\b/g, replacement: 'applicant_email' },

  { pattern: /\btitel\b/gi, replacement: match => (match === match.toUpperCase() ? 'TITLE' : 'title') },
  { pattern: /\bbeschreibung\b/gi, replacement: match => (match === match.toUpperCase() ? 'DESCRIPTION' : 'description') },
  { pattern: /\bkaltmiete\b/gi, replacement: match => (match === match.toUpperCase() ? 'PRICE' : 'price') },
  { pattern: /\bwarmmiete\b/gi, replacement: match => (match === match.toUpperCase() ? 'TOTAL_RENT' : 'total_rent') },
  { pattern: /\bwohnflaeche\b/gi, replacement: match => (match === match.toUpperCase() ? 'SIZE' : 'size') },
  { pattern: /\bwohnfläche\b/gi, replacement: match => (match === match.toUpperCase() ? 'SIZE' : 'size') },
  { pattern: /\bzimmer\b/gi, replacement: match => (match === match.toUpperCase() ? 'ROOMS' : 'rooms') },
  { pattern: /\bschlafzimmer\b/gi, replacement: match => (match === match.toUpperCase() ? 'BEDROOMS' : 'bedrooms') },
  { pattern: /\bbadezimmer\b/gi, replacement: match => (match === match.toUpperCase() ? 'BATHROOMS' : 'bathrooms') },
  { pattern: /\betage\b/gi, replacement: match => (match === match.toUpperCase() ? 'FLOOR' : 'floor') },
  { pattern: /\bstrasse\b/gi, replacement: match => (match === match.toUpperCase() ? 'ADDRESS' : 'address') },
  { pattern: /\bhausnummer\b/gi, replacement: match => (match === match.toUpperCase() ? 'HOUSE_NUMBER' : 'house_number') },
  { pattern: /\bplz\b/gi, replacement: match => (match === match.toUpperCase() ? 'POSTAL_CODE' : 'postal_code') },
  { pattern: /\bort\b/gi, replacement: match => (match === match.toUpperCase() ? 'CITY' : 'city') },
  { pattern: /\bbundesland\b/gi, replacement: match => (match === match.toUpperCase() ? 'STATE' : 'state') },
  { pattern: /\bvermieter\b/gi, replacement: match => (match === match.toUpperCase() ? 'LANDLORD' : 'landlord') },
  { pattern: /\bmieter\b/gi, replacement: match => (match === match.toUpperCase() ? 'APPLICANT' : 'applicant') },
  { pattern: /\bvorname\b/gi, replacement: match => (match === match.toUpperCase() ? 'FIRST_NAME' : 'first_name') },
  { pattern: /\bnachname\b/gi, replacement: match => (match === match.toUpperCase() ? 'LAST_NAME' : 'last_name') },
  { pattern: /\bbenutzername\b/gi, replacement: match => (match === match.toUpperCase() ? 'USERNAME' : 'username') },
  { pattern: /\btelefon\b/gi, replacement: match => (match === match.toUpperCase() ? 'PHONE' : 'phone') },
  { pattern: /\bgesamtbewertung\b/gi, replacement: match => (match === match.toUpperCase() ? 'RATING' : 'rating') },
  { pattern: /\bwunschdatum_1\b/gi, replacement: match => (match === match.toUpperCase() ? 'PREFERRED_DATE_1' : 'preferred_date_1') },
  { pattern: /\bwunschdatum_2\b/gi, replacement: match => (match === match.toUpperCase() ? 'PREFERRED_DATE_2' : 'preferred_date_2') },
  { pattern: /\bwunschdatum_3\b/gi, replacement: match => (match === match.toUpperCase() ? 'PREFERRED_DATE_3' : 'preferred_date_3') },
  { pattern: /\bbestaetigtes_datum\b/gi, replacement: match => (match === match.toUpperCase() ? 'CONFIRMED_DATE' : 'confirmed_date') },
  { pattern: /\bzahlungsstatus\b/gi, replacement: match => (match === match.toUpperCase() ? 'PAYMENT_STATUS' : 'payment_status') },
  { pattern: /\bstatus_notiz\b/gi, replacement: match => (match === match.toUpperCase() ? 'status_note' : 'status_note') },

  // Variable names
  { pattern: /minKaltmiete/g, replacement: 'minPrice' },
  { pattern: /maxKaltmiete/g, replacement: 'maxPrice' },
  { pattern: /minWarmmiete/g, replacement: 'minTotalRent' },
  { pattern: /maxWarmmiete/g, replacement: 'maxTotalRent' },
  { pattern: /minWohnflaeche/g, replacement: 'minSize' },
  { pattern: /maxWohnflaeche/g, replacement: 'maxSize' }
];

function walkDirectory(dirPath, fileHandler) {
  if (!fs.existsSync(dirPath)) {
    return;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  entries.forEach(entry => {
    const entryPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(entryPath, fileHandler);
    } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
      fileHandler(entryPath);
    }
  });
}

function applyReplacements(filePath) {
  const relativePath = path.relative(workspaceRoot, filePath);
  if (relativePath.includes(path.join('netlify', 'functions', 'utils', 'field-mapper.mjs'))) {
    return;
  }

  let originalContent = fs.readFileSync(filePath, 'utf8');
  let updatedContent = originalContent;

  replacements.forEach(({ pattern, replacement }) => {
    updatedContent = updatedContent.replace(pattern, replacement);
  });

  if (updatedContent !== originalContent) {
    fs.writeFileSync(filePath, updatedContent, 'utf8');
    console.log(`Updated: ${relativePath}`);
  }
}

for (const targetDir of targetDirectories) {
  walkDirectory(targetDir, applyReplacements);
}
