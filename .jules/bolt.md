## 2026-02-18 - Kanban Column Memoization
**Learning:** Extracting list components (like Kanban columns) into memoized children is critical when using `dnd-kit`. Drag operations cause state changes (`activeId`) in the parent container, which triggers unnecessary re-renders of all lists if not memoized, leading to jank during drag start/end.
**Action:** When implementing drag-and-drop with `dnd-kit`, always separate the draggable lists into their own memoized components to isolate them from global drag state updates.
