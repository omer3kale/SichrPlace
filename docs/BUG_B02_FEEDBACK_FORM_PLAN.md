# B02 Feedback Form Availability Plan

## Observations

- Embedded Google Form intermittently shows "Form unavailable" or a blank state, while opening the direct link works.
- Users see the error on initial load, then have to click the CTA to open the form in a new tab.
- Current embed lacks load/error handling and keeps the iframe visible even when it fails.

## Root Cause Hypothesis

- Google Forms occasionally blocks the embed (network latency, cookie restrictions, third-party blocking).
- No timeout or error detection exists, so users get stuck with the unavailable message inside the iframe.

## Remediation Steps

1. **Loading State & Timeout**
   - Add a loader/placeholder that appears immediately while the iframe attempts to load.
   - Monitor the iframe `load` event; when it fires, hide the loader and make the form visible.
   - If the load event hasn’t fired within 6–8 seconds, assume failure: hide the iframe, show the fallback card, and surface the "open in new tab" CTA.

2. **Explicit Error Handling**
   - Subscribe to the iframe `error` event (supported in modern browsers) to flip to fallback immediately if the resource is blocked.
   - Set `title`, `aria-hidden`, and status messages for screen readers.

3. **UX Messaging**
   - Update fallback copy to clarify that permissions/privacy blockers may prevent the embed.
   - Keep the primary CTA button (opens new tab) for users who prefer the direct form.

4. **Testing**
   - Validate in browsers with third-party cookies disabled or strict tracking protection.
   - Confirm fallback triggers both on actual load failures (simulated by offline mode) and when the embed succeeds.
   - Capture before/after screenshots for QA sign-off.

## Exit Criteria

- Embedded form displays a loading indicator and transitions to the live form when available.
- On failure, the iframe is hidden, fallback instructions with the direct link become visible, and the user is not left with an unusable widget.
- Accessibility: loader announces progress, fallback message is readable via screen readers, and focus management remains intact.
