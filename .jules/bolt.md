## 2026-02-18 - Kanban Column Memoization
**Learning:** Extracting list components (like Kanban columns) into memoized children is critical when using `dnd-kit`. Drag operations cause state changes (`activeId`) in the parent container, which triggers unnecessary re-renders of all lists if not memoized, leading to jank during drag start/end.
**Action:** When implementing drag-and-drop with `dnd-kit`, always separate the draggable lists into their own memoized components to isolate them from global drag state updates.

## 2024-02-18 - Avoid O(N) Filters in O(M) Data Visualization Loops
**Learning:** In data-visualization tools (like `ApplicationHistoryChart`), calculating a cumulative total by iterating over an array of days and filtering a large dataset of jobs (`O(N*M)`) creates significant frontend lag as the number of jobs grows. Since the job data is already pre-sorted by date, this pattern is completely unnecessary.
**Action:** Always refactor sequential grouping or filtering over pre-sorted data into a single-pass pointer (`O(N+M)`) approach, maintaining an index or cumulative counter across the iterations.

## 2025-03-04 - Optimize Date Parsing in Loops
**Learning:** Calling functions like `safeDate` (which involves object creation and parsing) repeatedly inside O(N log N) `Array.sort` comparisons or nested O(N) loops creates a performance bottleneck as the dataset grows.
**Action:** When performing repeated date comparisons, always convert dates to primitive timestamps (`.getTime()`) upfront in a single O(N) pass, then use the primitive values for subsequent sorting and filtering.
