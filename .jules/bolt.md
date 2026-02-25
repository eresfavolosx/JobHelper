## 2026-02-18 - Kanban Column Memoization
**Learning:** Extracting list components (like Kanban columns) into memoized children is critical when using `dnd-kit`. Drag operations cause state changes (`activeId`) in the parent container, which triggers unnecessary re-renders of all lists if not memoized, leading to jank during drag start/end.
**Action:** When implementing drag-and-drop with `dnd-kit`, always separate the draggable lists into their own memoized components to isolate them from global drag state updates.

## 2026-02-25 - Date Operations in Loops
**Learning:** Repeatedly creating `Date` objects or using helper functions like `safeDate` inside nested loops (O(N*M)) kills performance. A chart rendering 5000 jobs took ~1600ms.
**Action:** Pre-convert dates to primitive timestamps (numbers) once (O(N)), then use simple number comparison in loops. This reduced execution time to ~9ms.
