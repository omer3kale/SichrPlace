# B01 Mobile UI Remediation Plan

## Current Findings

- **Navigation overflow:** `header nav` keeps a horizontal layout down to mobile widths, causing buttons to wrap unpredictably and overlap the logo.<br>Impact: primary CTAs (login, apartments, marketplace) become hard to tap on phones.
- **Hero readability:** Headline and background animation remain desktop-sized (`font-size: 3.5rem`), leaving no breathing space on 320–375px screens. Secondary copy pushes below the fold.
- **Section spacing:** Matching, slider, and footer sections use wide paddings (32–60px) and side-by-side grids without mobile overrides. Cards shrink too far or overflow the viewport.
- **Language dropdown:** Inline absolute positioning ties the dropdown to desktop layout; on phones the dropdown can fall off-screen.

## Proposed Workstreams

1. **Responsive header & navigation**
   - Introduce a hamburger toggle (`button#mobile-menu-toggle`) shown under 768px.
   - Collapse `nav` into a vertical panel with focus trapping and animation; ensure marketplace button stays visible as first action.
   - Adjust language dropdown to anchor inside the mobile panel or convert to a full-width list.

2. **Hero & global typography scaling**
   - Add `@media` breakpoints at 768px and 480px dialing back hero `font-size`, padding, and animation intensity.
   - Limit hero copy width (`max-width: 90vw`) and elevate CTA button tap targets to 48px minimum.

3. **Section layout adjustments**
   - Provide utility classes / overrides so 2-column grids (`display:grid;grid-template-columns:1fr 1fr`) stack to a single column on small screens.
   - Reduce horizontal padding to 16px, harmonize card spacing, and ensure sliders maintain 16px gutters.
   - Update footer links to wrap cleanly with centered alignment.

4. **Verification & regression coverage**
   - Test in Chrome DevTools for iPhone SE, iPhone 14, Pixel 7, iPad Mini breakpoints.
   - Capture before/after screenshots for the home page, apartments listing, and dashboard shell if they reuse header.
   - Add Playwright/Lighthouse checks for mobile viewport layout shifts once CSS changes land.

## Acceptance Criteria

- Navigation remains fully usable at 320px width via hamburger menu; no horizontal scroll on body.
- Hero section renders headline and key CTA above the fold on common devices.
- Feature/matching/slider sections stack vertically with 16–24px padding and no clipped text or imagery.
- Language selector, marketplace button, and footer links remain accessible and tap-friendly throughout.

## Next Steps

1. Implement responsive header & navigation (highest UX impact).
2. Adjust hero and section breakpoints, then validate across the home page.
3. Extend responsive utilities to other shared layouts (apartments listing, dashboards) if they share classes.
4. Document results in `GOOGLE_FEEDBACK_BUG_STATUS.md` and hand off to QA for mobile regression run.
