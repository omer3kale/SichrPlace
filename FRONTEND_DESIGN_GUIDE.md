# SichrPlace Frontend Design Guide

Quick reference for designers working on the SichrPlace frontend.

---

## 🎨 Design System

### Colors
```css
--primary: #2563eb     /* Blue - Primary actions, headers */
--secondary: #f0f4ff   /* Light blue - Backgrounds */
--accent: #f59e0b      /* Orange - Highlights, CTAs */
--text: #1f2937        /* Dark gray - Body text */
--muted: #6b7280       /* Gray - Secondary text */
--success: #10b981     /* Green - Success states */
--error: #ef4444       /* Red - Errors, alerts */
--warning: #f59e0b     /* Orange - Warnings */
```

### Typography
- **Headings**: `--heading-font: 'Montserrat', sans-serif` (Bold, modern)
- **Body**: `--body-font: 'Open Sans', sans-serif` (Clean, readable)
- **Sizes**: 
  - H1: 2.5rem
  - H2: 2rem
  - H3: 1.5rem
  - Body: 1rem
  - Small: 0.875rem

### Spacing
- Use multiples of 4px: 4px, 8px, 12px, 16px, 20px, 24px, 32px
- Standard padding: 20px containers, 16px cards
- Standard gap: 16px for grids, 8px for inline elements

---

## 📁 File Structure

```
frontend/
├── index.html                 # Homepage
├── apartments-listing.html    # Search & filters
├── login.html                 # Auth pages
├── instruction-guide.html     # User guide
├── tenant-dashboard.html      # User dashboards
├── landlord-dashboard.html
└── css/
    └── styles.css            # Global styles

js/
├── translation-handler.js    # Multi-language support
└── frontend/
    └── js/
        └── translations.json # EN/DE/TR translations
```

---

## 🎯 Key Components

### Buttons
```html
<!-- Primary -->
<button style="background: var(--primary); color: white; padding: 12px 24px; border-radius: 8px; border: none; font-weight: 600;">
  Click Me
</button>

<!-- Secondary -->
<button style="background: var(--secondary); color: var(--primary); padding: 12px 24px; border-radius: 8px; border: 2px solid var(--primary);">
  Secondary
</button>
```

### Cards
```html
<div style="background: white; padding: 24px; border-radius: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
  Card content here
</div>
```

### Icons
- Using **Font Awesome 6** (`<i class="fas fa-icon-name"></i>`)
- Common icons: `fa-home`, `fa-search`, `fa-user`, `fa-filter`, `fa-heart`

---

## 🌍 Multi-Language Support

Add `data-translate` attribute to any text:
```html
<h1 data-translate="hero.title">Find Your Perfect Apartment</h1>
<button data-translate="nav.login">Login</button>
```

Translation keys are in `js/frontend/js/translations.json` (EN/DE/TR).

---

## 📱 Responsive Design

- **Mobile**: 320px - 767px
- **Tablet**: 768px - 1023px
- **Desktop**: 1024px+

Use CSS Grid for layouts:
```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
gap: 16px;
```

---

## ✨ Common Patterns

### Filter Modal
- Sticky header/footer
- Scrollable content (max-height: 80vh)
- Apply/Clear buttons always visible

### Form Inputs
```html
<input type="text" style="width: 100%; padding: 10px; border: 1px solid #e1e5e9; border-radius: 6px; font-size: 14px;">
```

### Loading States
```html
<div style="text-align: center; padding: 40px; color: var(--muted);">
  <i class="fas fa-spinner fa-spin" style="font-size: 2rem;"></i>
  <p>Loading...</p>
</div>
```

---

## 🚀 Quick Start

1. **Edit HTML files** in `frontend/` folder
2. **Use CSS variables** for colors (never hardcode hex)
3. **Add translations** for any new text in `translations.json`
4. **Test mobile** - resize browser to 375px width
5. **Preview locally** - open HTML file in browser

---

## 📋 Design Checklist

- [ ] Used CSS variables for all colors
- [ ] Added `data-translate` for all user-facing text
- [ ] Tested on mobile (375px), tablet (768px), desktop (1440px)
- [ ] Used Font Awesome icons consistently
- [ ] Followed 4px spacing multiples
- [ ] Border radius: 6-12px for cards/buttons
- [ ] Box shadows: `0 2px 8px rgba(0,0,0,0.1)`

---

## 💡 Tips

- **Keep it simple** - Users prefer clean, minimal design
- **Prioritize mobile** - Most users browse on phones
- **Use white space** - Don't cram everything together
- **Consistent spacing** - Makes UI feel professional
- **Test translations** - Switch language and check layout doesn't break

---

**Questions?** Check `docs/` folder for detailed specs or ask the team!
