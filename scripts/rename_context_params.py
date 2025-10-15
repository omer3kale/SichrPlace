from pathlib import Path

root = Path('netlify/functions')
for path in root.rglob('*.mjs'):
    text = path.read_text(encoding='utf-8')
    new = text
    new = new.replace(', context)', ', _context)')
    new = new.replace(', context) =>', ', _context) =>')
    new = new.replace('(context) =>', '(_context) =>')
    new = new.replace('(context) =>', '(_context) =>')
    new = new.replace('( context)', '(_context)')
    if new != text:
        path.write_text(new, encoding='utf-8')
