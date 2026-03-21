## 2026-02-18 - Kanban Column Memoization
**Learning:** Extracting list components (like Kanban columns) into memoized children is critical when using `dnd-kit`. Drag operations cause state changes (`activeId`) in the parent container, which triggers unnecessary re-renders of all lists if not memoized, leading to jank during drag start/end.
**Action:** When implementing drag-and-drop with `dnd-kit`, always separate the draggable lists into their own memoized components to isolate them from global drag state updates.

## 2024-02-18 - Avoid O(N) Filters in O(M) Data Visualization Loops
**Learning:** In data-visualization tools (like `ApplicationHistoryChart`), calculating a cumulative total by iterating over an array of days and filtering a large dataset of jobs (`O(N*M)`) creates significant frontend lag as the number of jobs grows. Since the job data is already pre-sorted by date, this pattern is completely unnecessary.
**Action:** Always refactor sequential grouping or filtering over pre-sorted data into a single-pass pointer (`O(N+M)`) approach, maintaining an index or cumulative counter across the iterations.

## 2025-03-04 - Optimize Date Parsing in Loops
**Learning:** Calling functions like `safeDate` (which involves object creation and parsing) repeatedly inside O(N log N) `Array.sort` comparisons or nested O(N) loops creates a performance bottleneck as the dataset grows.
**Action:** When performing repeated date comparisons, always convert dates to primitive timestamps (`.getTime()`) upfront in a single O(N) pass, then use the primitive values for subsequent sorting and filtering.
## 2026-03-07 - Pre-calculate Primitive Types for Repeated Sorting/Filtering
**Learning:** In JavaScript, calling functions like `safeDate` or `new Date()` that perform parsing and object allocation within tightly-looped callbacks (e.g. `Array.prototype.sort()` which is O(N log N) or inside `while` loops iterating over large datasets) severely impacts CPU and memory.
**Action:** Before sorting or sequentially iterating arrays of objects based on a derived value (like a timestamp from a date string), execute a single O(N) pass (`.map()`) to extract and pre-calculate the required primitive values (e.g. `.getTime()`) onto the objects, then use those primitives in subsequent high-complexity operations.
## 2025-03-10 - Avoid Repeated O(N) Array Traversals in Render
**Learning:** Calculating multiple derived statistics (e.g., status counts) by chaining or repeating `.filter()` calls over a large array (like `jobs`) results in O(k*N) time complexity and unnecessary recalculations on every render.
**Action:** When deriving multiple aggregates from a single dataset, use a single-pass loop (like `reduce`) and wrap the calculation in a `useMemo` hook to reduce time complexity to O(N) and prevent recalculation unless the dependencies change.
## 2026-03-08 - Avoid Multiple Array.filters for Derived Stats
**Learning:** In components calculating multiple derived statistics from a single data source (like dashboard counts), chaining or repeating `Array.filter` calls over the same array is an anti-pattern. If there are `k` filters, the time complexity becomes `O(k*N)`.
**Action:** When calculating multiple derived statistics from an array (e.g., status counts), use a single-pass loop inside a `useMemo` hook rather than chaining or repeating `.filter()` calls to reduce time complexity from `O(k*N)` to `O(N)`.
## 2026-03-16 - Avoid O(N) Array Lookups in Loops
**Learning:** Using `Array.prototype.find()` inside an `Array.prototype.map()` loop creates an O(N*M) time complexity. For operations like merging scores into jobs, this severely degrades performance as datasets grow.
**Action:** Refactor the inner lookup by extracting the data into an intermediate `Map` or plain object before the loop, enabling O(1) lookups and reducing overall complexity to O(N).

## 2026-03-24 - Extract Repeated Expensive Functions
**Learning:** Functions that parse data or perform complex logic (e.g. `safeDate`) are often called repeatedly in JSX inline bindings (like title and text content), degrading performance during list rendering.
**Action:** Extract expensive logic calculations to a single constant before the `return` statement in React components and reuse the calculated value in JSX to reduce processing overhead on every render.
