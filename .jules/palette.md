## 2026-02-14 - Hidden Focusable Elements
**Learning:** Icon-only buttons in `JobCard.js` were set to `opacity: 0` and only shown on hover, making them invisible to keyboard users even when focused.
**Action:** Used `useState` to track `isFocused` on the button container and conditionally set opacity, ensuring buttons are visible when tabbed into. Added `aria-label` and `title` for better accessibility.
