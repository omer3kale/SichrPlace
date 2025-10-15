# Web-Derived Fix Ideas

## 1. Persisting the Language Switcher
- Use `localStorage.setItem()`/`getItem()` for the language code so selections persist across reloads. MDN notes that `localStorage` stores key/value pairs per origin and survives browser restarts[^1].
- Wrap storage access in `try`/`catch` to surface `SecurityError` (blocked storage, private browsing, invalid scheme) and fall back to a safe default[^1].

## 2. Guarding Against Storage Failures
- Feature-detect storage with the `storageAvailable()` pattern before writing. MDN’s Web Storage guide recommends testing read/write access to avoid quota and private mode failures[^2].
- If storage is unavailable, keep language state in memory for the session or fall back to query params/cookies.

## 3. Aligning ESLint Configuration
- ESLint supports a single `eslint.config.js` (flat config) or legacy `.eslintrc.*`. Consolidate on one format and share rule presets through configuration files rather than per-directory overrides[^3].
- Use the official ignore mechanisms instead of ad-hoc scripts (`.eslintignore` or `ignores` in the flat config) so tooling stays consistent[^3].

## 4. Netlify Function Packaging
- Netlify Functions deploy with the site, giving versioned, branch-aware previews. Verify that new functions (`feedback`, `add-property-legacy`) and their tests live under the expected `/netlify/functions` tree to benefit from automatic API gateway wiring[^4].
- Keep payload limits (6 MB buffered requests, 1024 MB memory) in mind when adding attachments or large responses[^4].

[^1]: [MDN Web Docs — Window: localStorage property](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
[^2]: [MDN Web Docs — Using the Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API)
[^3]: [ESLint Docs — Configure ESLint](https://eslint.org/docs/latest/use/configure/)
[^4]: [Netlify Docs — Functions overview](https://docs.netlify.com/functions/overview/)
