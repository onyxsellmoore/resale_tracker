# QA Analysis: Luxury Resale Bookkeeping App Implementation Plan

## Executive Summary

Review of 15 implementation tasks across React 19 web (11 tasks) and SwiftUI iOS (4 tasks) platforms. **3 test files will require significant updates, 4 new test files are required, and 1 high-risk regression identified** (Task 08 undo window logic).

---

## WEB TESTS — DETAILED IMPACT ANALYSIS

### TASK 01: NavBar Sticky + SVG Hamburger + CTA Hierarchy

**Affected Test File:** `booking-ui/src/components/NavBar.test.tsx`

**Breaking Changes:**
- **TEXT ASSERTION FAILURE**: Tests at lines 48, 55 search for "Add Item" and "Record a Sale" by text. If hamburger menu collapses these into the drawer, the text locators will fail.
  - Line 48: `expect(screen.getByRole('link', { name: /add item/i }))`
  - Line 55: `expect(screen.getByRole('link', { name: /record a sale/i }))`
  - **Fix**: Update to check for button/drawer trigger when mobile, or mock a desktop viewport

**New Tests Required:**
1. SVG hamburger renders and morphs to X when drawer opens
2. "Add Item" link has `btn-ghost` or `btn-outline` class (lower visual weight vs "Record a Sale")
3. "Record a Sale" button maintains primary styling (higher weight)
4. NavBar has `position: sticky`, `top: 0`, `backdrop-filter: blur(10px)` applied
5. Drawer only visible when `drawerOpen === true`

**Regression Risks:**
- aria-current="page" test (line 78) may break if hamburger menu repositions the link — ensure it still detects active route
- If drawer animation uses CSS transitions, ensure test timers don't cause false failures

---

### TASK 02: Login Page Vertical Center + Brand Hero

**Affected Test File:** `booking-ui/src/pages/LoginPage.test.tsx`

**Breaking Changes:**
- **LAYOUT STRUCTURE**: Tests render LoginPage but don't validate layout. If new hero section added above form card, no breaks expected at test assertions.
- **No existing assertions will break**, but visibility/accessibility of form inputs must be verified.

**New Tests Required:**
1. Hero section (h1 + tagline) renders above login form
2. h1 uses Playfair font family
3. Tagline text has muted color (gray/secondary)
4. Form card remains inside full-height flex container and is vertically centered
5. Form inputs (email, passkey button) are still accessible and not obscured

**Regression Risks:**
- If new CSS uses `position: absolute` or `overflow: hidden` on parent, form inputs may become unreachable
- Mobile viewport may overflow if hero image is too large — test responsive behavior

---

### TASK 03: Analytics Date Presets + Profit Margin Card

**Affected Test Files:**
- `booking-ui/src/components/SummaryCards.test.tsx` (adds 7th card)
- `booking-ui/src/pages/AnalyticsPage.test.tsx` (adds preset buttons)

**Breaking Changes in SummaryCards.test.tsx:**

1. **Line 35**: Test expects 6 cards, will now expect 7
   ```tsx
   // BREAKS: it('renders all 6 cards', () => { ... })
   // FIX: Update to check for 7 cards including "Profit Margin"
   ```

2. **New assertions needed for the 7th card:**
   - Card title: "Profit Margin"
   - Card value: formatted as "XX.X%" (e.g., "54.0%")
   - Test case: `totalRevenue === 0` → shows "—" instead of percentage
   - Test case: negative profit → negative percentage displayed correctly (e.g., "-130.0%")

**Breaking Changes in AnalyticsPage.test.tsx:**

- Line 47: Current test only checks "renders without throwing" — too minimal
- **No breaking assertions**, but test coverage is insufficient

**New Tests Required (AnalyticsPage):**
1. Preset buttons render: "This Month", "Last Month", "This Year"
2. Clicking "This Month" button sets `from` to start of month and `to` to today
3. Clicking "Last Month" button sets correct date range
4. Clicking "This Year" button sets `from` to Jan 1 and `to` to today
5. Preset selection updates existing date inputs (verify two-way binding)
6. Clear/reset button clears preset selection if implemented
7. Preset changes trigger `getAnalytics` API call with updated date params

**New Tests Required (SummaryCards):**
1. "Profit Margin" card renders as 7th card
2. Profit margin calculated as `(totalProfit / totalRevenue) * 100`
3. Card shows "—" when `totalRevenue === 0`
4. Card shows "—" when `totalRevenue === undefined`
5. Negative profit margins display as negative percentage (e.g., "-130.0%")
6. Formatting is exactly "XX.X%" (1 decimal place)
7. Card color is neutral (not red/green) — it's an informational metric

**Regression Risks:**
- Grid auto-reflow in CSS: verify responsive layout doesn't break on mobile (7 cards may wrap unexpectedly)
- Profit margin division by zero: must guard with `if (totalRevenue === 0)` to avoid `NaN`
- If card animations stagger, ensure 7th card also animates correctly

---

### TASK 04: Inventory Search Input

**Affected Test File:** `booking-ui/src/components/InventoryTable.test.tsx`

**No Breaking Changes to Existing Tests** (all current assertions remain valid)

**New Tests Required:**
1. Search input renders above status filter dropdown
2. Search input has 300ms debounce (verify no API calls made on every keystroke)
3. Filtering by name: typing "Gucci" hides "Prada Shoes" row
4. Filtering by brand: typing "LV" hides "Gucci Bag" row
5. Case-insensitive search: typing "gucci" matches "Gucci Bag"
6. Search clears results: typing text, then clearing input shows all items again
7. Empty search results display EmptyState: "No items matching '[query]'" with a Clear button
8. Clear button in empty state: clicking clears search input and shows all items
9. Search filters work with status filter in combination (both active)
10. Search input is debounced correctly — no re-renders before 300ms timeout

**Regression Risks:**
- Row hover already exists in CSS (note in task spec) — ensure search doesn't remove row hover on filtered items
- If search is not debounced, may cause performance issues and test failures due to async state updates
- "No items matching" empty state must be distinct from the general "No inventory items" empty state

---

### TASK 05: Status Badge Capitalization + Dot Indicator

**Affected Test File:** `booking-ui/src/components/InventoryTable.test.tsx`

**Breaking Changes:**

1. **Lines 60, 67**: Badge text assertions will break
   ```tsx
   // BREAKS:
   // Line 60: expect(badge).toHaveTextContent('AVAILABLE')  → now 'Available'
   // Line 67: expect(badge).toHaveTextContent('SOLD')       → now 'Sold'
   ```

2. **Lines 61, 68**: Class name assertions are safe (still `status-badge-available` and `status-badge-sold`)

**Fixes Required:**
- Update line 60: `expect(badge).toHaveTextContent('Available')`
- Update line 67: `expect(badge).toHaveTextContent('Sold')`

**New Tests Required:**
1. Badge has `::before` pseudo-element with colored dot
2. Dot color for AVAILABLE: green (verify `--color-success` or equivalent)
3. Dot color for SOLD: gray (verify `--color-muted` or equivalent)
4. Dot is rendered before the text (visual order)
5. Display text changes only; `item.status` value remains "AVAILABLE" or "SOLD" (immutable)

**Regression Risks:**
- Pseudo-element `::before` visibility: ensure it's not hidden by overflow or z-index issues
- If CSS uses `content: ''` without explicit background-color, dot won't render

---

### TASK 06: Delete Confirmation Red Row State

**Affected Test File:** `booking-ui/src/components/InventoryTable.test.tsx`

**No Breaking Changes to Existing Tests** (delete confirmation flow already tested)

**New Tests Required:**
1. When `confirmingDeleteId === item.id`, the row has `.row-confirming-delete` class applied
2. Row background becomes muted red tint when confirming (visual verification or color assertion)
3. Confirm button (red destructive style) renders inside confirming row only
4. Cancel button (ghost style) appears adjacent to Confirm button
5. Hovering over red row doesn't change appearance (red tint persists)
6. Clicking Confirm on red row calls `onDelete(id)` and changes appearance back to normal
7. Clicking Cancel on red row removes `.row-confirming-delete` class

**Regression Risks:**
- Red background must have sufficient contrast for accessibility (WCAG AA)
- If z-index not managed, red row styling may be obscured by other elements
- Confirm/Cancel button positioning must not overflow the table horizontally

---

### TASK 07: AddItemForm Animated Panel + Save & Add Another + Inline Validation

**Affected Test Files:**
- `booking-ui/src/components/AddItemForm.test.tsx`
- `booking-ui/src/pages/InventoryPage.test.tsx`

**Breaking Changes in AddItemForm.test.tsx:**

1. **Line 67-75**: Validation error display location changes from form-level to inline beneath each field
   ```tsx
   // BREAKS: expect(screen.getByText(/name is required/i))
   // FIX: Update to locate error message below name input specifically
   ```

2. **Line 77-89**: Same issue for purchase price validation error
   ```tsx
   // BREAKS: expect(screen.getByText(/price must be.*0/i))
   // FIX: Locate error message in context of the price input field
   ```

**Fixes Required:**
- Update lines 73, 87 to use `within(nameInput.parentElement)` or similar to scope error messages
- Verify error text is inside the field's container, not at form root

**New Tests Required (AddItemForm):**
1. "Save & Add Another" button renders as secondary button (lower visual weight)
2. Clicking "Save & Add Another" submits form without closing the side panel
3. After "Save & Add Another" succeeds, all form fields reset to default values
4. Name field clears after "Save & Add Another" click
5. Purchase date resets to today after "Save & Add Another" click
6. Purchase price resets to empty after "Save & Add Another" click
7. onItemAdded callback fires after each "Save & Add Another" submission
8. Validation error for name appears inline beneath name input (not elsewhere)
9. Validation error for price appears inline beneath price input
10. Inline validation errors clear when user corrects the field
11. Multiple errors (e.g., name + price) display all inline messages simultaneously

**New Tests Required (InventoryPage):**
1. Side panel has slide-in animation (CSS class applied)
2. Panel slides in from right (verify `@keyframes slideInRight` is applied)
3. Slide-in animation duration is ~300ms (visual smoothness)
4. Panel height fills viewport (no cutoff)
5. Clicking outside panel does NOT close it (unlike typical modals)
6. "Save & Add Another" flow: submit, verify panel stays open, form resets
7. Regular "Add Item" button still closes panel after submission

**Regression Risks:**
- Inline validation errors must not shift form layout (ensure fixed height for error messages)
- Animation timing: if slideInRight is too fast/slow, UX suffers but tests pass
- If panel overflow is hidden, input focus/error messages may be cut off
- "Save & Add Another" multiple submissions: ensure each fires `onItemAdded` independently

---

### TASK 08: Toast Undo Action Support (HIGHEST REGRESSION RISK)

**Affected Test Files:**
- `booking-ui/src/components/Toast.test.tsx`
- `booking-ui/src/pages/InventoryPage.test.tsx`

**Breaking Changes in Toast.test.tsx:**

1. **Lines 28-34**: Dismiss button test name/role may change
   ```tsx
   // POTENTIALLY BREAKS: screen.getByRole('button', { name: /dismiss/i })
   // If button text changes from "✕" to "✕ Undo", this may still pass
   // But if Undo button is separate, need two button assertions
   ```

**New Tests Required (Toast):**
1. Toast renders "Undo" button when `onUndo` prop is provided
2. Toast does NOT render "Undo" button when `onUndo` is undefined
3. Clicking "Undo" button calls `onUndo()` callback
4. "Undo" button appears BEFORE dismiss button (left-to-right order)
5. "Undo" button has gold color styling
6. "Undo" button has no border (style verification)
7. `undoLabel` prop customizes button text (default: "Undo")
8. Toast duration still auto-dismisses even with Undo button present

**New Tests Required (InventoryPage):**

This is where **HIGHEST REGRESSION RISK** lies. The undo window requires complex async state management:

1. **Optimistic deletion:**
   - Clicking delete button immediately removes item from UI
   - Item is removed from React Query cache optimistically
   - Verify item no longer appears in table

2. **Undo window (5 seconds):**
   - Undo toast displays with 5-second countdown timer
   - Toast auto-dismisses after 5 seconds (undo window closes)
   - Toast appears with `onUndo` callback configured

3. **Undo button clicked:**
   - Clicking "Undo" restores item to React Query cache
   - Item reappears in table
   - DELETE API call is cancelled (never sent)
   - Toast dismisses
   - Verify item is back with original data

4. **Undo window expires (5 seconds, no click):**
   - Toast auto-dismisses
   - DELETE API call is committed and sent
   - Item remains deleted from UI
   - Verify API was called with correct item ID

5. **Edge cases:**
   - Deleting two items in rapid succession: each has independent 5-second window
   - Undoing first item restores only that item
   - Second delete still proceeds after 5 seconds
   - If user refreshes page during undo window, deletion persists (API not called yet)

**Regression Risks (CRITICAL):**

1. **Race conditions in undo logic:**
   - If API call fires before 5-second timer completes, undo button click will restore a deleted item
   - Must ensure DELETE API is ONLY called after 5 seconds OR after user doesn't click Undo
   - **Implementation challenge**: Store item state, await 5 seconds, then check if undo was clicked

2. **React Query cache synchronization:**
   - Optimistically removing from cache can cause stale data if component re-renders
   - Restoring to cache must use correct item data (not partial/stale copy)
   - **Test must verify**: item data is identical before/after undo (all fields present)

3. **Multiple undos in quick succession:**
   - If user deletes 3 items, then undoes all 3, each undo must restore independently
   - Each should have separate 5-second timer
   - **Test must verify**: toasts stack or queue correctly, each has own undo handler

4. **API error handling:**
   - If DELETE API fails AFTER undo window closes, how is error surfaced?
   - Undo button will be gone, but item was already removed from UI
   - **Test must cover**: API error after undo window → error toast to user? Item stays deleted?

5. **Test timing with fake timers:**
   - Must use `vi.useFakeTimers()` to control 5-second window
   - Tests must `vi.advanceTimersByTime(5000)` to trigger API call
   - **Risk**: If real timers used in production, timing is unpredictable in tests

---

### TASK 09: Empty State Polish

**Affected Test File:** `booking-ui/src/components/EmptyState.test.tsx`

**Breaking Changes:**
- **No breaking changes** — new `icon` prop is optional

**New Tests Required:**
1. EmptyState renders icon when `icon` prop is provided
2. Icon renders above title (visual hierarchy)
3. Icon can be Lucide icon name (string) — renders SVG
4. Icon can be emoji — renders as text
5. EmptyState works without icon (backward compatible)
6. Icon has proper styling/sizing (not oversized or cut off)

**Additional Tests for Pages (InventoryPage, SalesPage, AnalyticsPage):**
1. InventoryPage EmptyState includes appropriate icon (e.g., "package" for inventory)
2. SalesPage EmptyState includes appropriate icon (e.g., "dollar-sign" for sales)
3. AnalyticsPage EmptyState includes appropriate icon (e.g., "chart-bar" for analytics)
4. "No search results" empty state in InventoryTable has distinct icon/copy
5. Copy text is improved and more descriptive (user-centric language)

**Regression Risks:**
- If Lucide icon fails to load, EmptyState must degrade gracefully (no blank space)
- Icon styling must not break existing card layouts

---

### TASK 10: Inline Style Cleanup (CSS Refactor)

**Test Impact:** NONE

**Why:** Pure CSS refactoring — no logic changes, no visual changes, no component API changes.

**However:**
- New CSS files must be created and imported correctly
- Inline styles must be completely migrated (no orphaned styles)
- CSS specificity must remain the same (no new cascading bugs)

**Verification (Non-test):**
1. All `style={{...}}` removed from:
   - AppLayout.tsx, LoginPage.tsx, InventoryPage.tsx, SalesPage.tsx, AnalyticsPage.tsx
2. Corresponding CSS files created:
   - AppLayout.css, LoginPage.css, InventoryPage.css, SalesPage.css, AnalyticsPage.css
3. Import statements added to each component
4. Visual regression testing: compare before/after screenshots (no pixel changes)

---

## iOS TESTS — DETAILED IMPACT ANALYSIS

### TASK 11: iOS Tab Bar Custom Appearance

**Test Impact:** NONE

**Why:**
- UITabBar.appearance() is UI setup, not logic
- No view model changes
- No data flow changes

**Verification (Manual):**
- Launch simulator in light mode: tab bar has correct background color
- Launch simulator in dark mode: colors aren't overridden by system dark mode
- Tab bar icons remain gold-tinted (AppTheme.Colors.gold)

---

### TASK 12: iOS ItemListView Enhancements (Search + Swipe + Status Badge)

**Affected Test File:** `booking-ios/BookingTests/Features/InventoryViewModelTests.swift`

**Breaking Changes:**
- **No breaking changes** — view model tests don't cover UI state like `searchText`

**New Tests Required (InventoryViewModelTests):**
1. `availableItems` computed property filters items by status === "AVAILABLE" (already tested, good)
2. New: `filteredItems(by searchText)` filters by name + brand client-side (if added to VM)
3. Search filter case-insensitive: searching "gucci" matches "Gucci Bag"
4. Search on empty string returns all items
5. Search on non-matching string returns empty array

**New View Model Logic (if search added to VM):**
- Add `@Published var searchText: String = ""` property
- Add computed property: `var filteredItems: [Item] { items.filter { ... } }`
- Search filters by name + brand (OR logic)

**UI Tests (SwiftUI @Testable or manual):**
1. Purchase price appears right-aligned in each row (two-column HStack)
2. Name + brand on left, price on right
3. Swipe action on AVAILABLE item reveals "Sell" button (gold color)
4. Swipe action on SOLD item does NOT reveal "Sell" button
5. Tapping "Sell" button opens RecordSaleSheet with item pre-selected
6. Search field renders and filters items (text filtering)
7. Search is case-insensitive
8. Status badge text is capitalized: "Available" and "Sold"
9. Available badge has green dot prefix
10. Sold badge has gray dot prefix

**Regression Risks:**
- Swipe action may conflict with row selection
- Search performance: large item lists may lag if filter is not optimized
- Pre-selecting item in RecordSaleSheet: must ensure form fields populate correctly

---

### TASK 13: iOS SalesListView: Search + Profit Arrow Icon

**Affected Test File:** `booking-ios/BookingTests/Features/SalesViewModelTests.swift`

**Breaking Changes:**
- **No breaking changes** — view model tests don't cover search or icons

**New Tests Required (SalesViewModelTests):**
1. `filteredSales(by searchText)` filters sales by item name or platform (if added to VM)
2. Search is case-insensitive
3. Search on empty string returns all sales

**UI Tests (SwiftUI or manual):**
1. Search field renders with `.searchable` modifier
2. Search filters sales by item name + platform (OR logic)
3. Profit arrow icon appears in profit HStack
4. Arrow is "↑" (SF Symbol "arrow.up") when profit >= 0
5. Arrow is "↓" (SF Symbol "arrow.down") when profit < 0
6. Arrow color matches profit color (green for positive, red for negative)
7. Arrow appears BEFORE profit amount text (left-to-right order)

**Regression Risks:**
- SF Symbols might not render in all iOS versions (use fallback if needed)
- Arrow color coding must match existing profit color coding (no visual inconsistency)

---

### TASK 14: iOS AnalyticsView: Date Presets + Profit Margin Card

**Affected Test File:** `booking-ios/BookingTests/Features/AnalyticsViewModelTests.swift`

**Breaking Changes:**
- **No breaking changes** to existing tests
- Line 51-54 tests default date range — still valid

**New Tests Required (AnalyticsViewModelTests):**
1. `from` and `to` properties default to ~30 days ago and today (already tested, good)
2. New helper function/computed property for date preset logic:
   - `setThisMonth()` sets `from` to 1st of current month, `to` to today
   - `setLastMonth()` sets `from` to 1st of last month, `to` to last day of last month
   - `setAllTime()` sets `from` to far past date (e.g., 2020-01-01), `to` to today
3. Each preset function triggers `fetchAnalytics()` with updated date range
4. Verify API call includes correct `from` and `to` query parameters

**New SummaryCard Test (AnalyticsViewModelTests):**
1. `profitMargin` computed property calculated as `(totalProfit / totalRevenue) * 100`
2. `profitMargin` returns nil or "-" when `totalRevenue === 0` (divide-by-zero guard)
3. `profitMargin` formatted as "XX.X%" (e.g., "54.0%", "-130.0%")

**UI Tests (SwiftUI or manual):**
1. Picker segmented control renders with 3 options: "This Month", "Last Month", "All Time"
2. Picker appears above date inputs (visual hierarchy)
3. Selecting "This Month" updates `from` and `to` in picker state
4. Selecting "Last Month" updates dates correctly
5. Selecting "All Time" updates dates correctly
6. Date picker inputs still work independently (manual date entry)
7. Profit Margin card (5th card) renders below other 4 cards
8. Profit Margin displays percentage (e.g., "54.0%")
9. Profit Margin shows "—" when revenue is 0
10. Profit Margin color is neutral (not red/green like profit card)

**Regression Risks:**
- Date preset logic must account for leap years and month boundaries
- "Last Month" boundary condition: test Dec 31 → last day of Dec is 31, not 30
- API call must be triggered after preset selection (not just state update)
- If Picker changes are not reflected in date inputs, two-way binding breaks

---

### TASK 15: iOS Haptic Feedback + Success Animation

**Test Impact:** VERY LIMITED

**Why:**
- `UIImpactFeedbackGenerator` cannot be unit-tested (requires real device/simulator with haptics)
- SwiftUI animations (.scale, .opacity) are visual — hard to unit-test

**Per CONTEXT.md:**
> "Passkey/biometric flows cannot be unit-tested per CONTEXT.md"

**Haptic feedback + animations fall into same category** — interactive/sensory, not logic-testable.

**What CAN be tested:**
1. After `vm.addItem()` succeeds and `validationError == nil`, verify `showSuccess` state becomes `true`
2. Success overlay renders when `showSuccess == true`
3. Checkmark icon (SF Symbol "checkmark.circle.fill") renders in overlay
4. Overlay auto-dismisses after 0.5 seconds (use `DispatchQueue.main.asyncAfter`)
5. Sheet dismisses after success animation completes

**New Tests Required (InventoryViewModelTests / AddItemTests):**
1. After successful `addItem()`, `validationError` is nil
2. UI can read `validationError == nil` to trigger success state
3. No new model properties or logic beyond what's already testable

**UI Tests (Manual/Snapshot):**
1. Checkmark overlay appears after successful item creation
2. Overlay uses scale + opacity animation (visual verification)
3. Animation duration is ~0.5 seconds
4. Sheet dismisses cleanly after animation
5. Same flow in `RecordSaleSheet` mirrors `AddItemSheet`

**Regression Risks:**
- If haptic feedback throws exception on simulator without haptics capability, app crashes
  - **Mitigation**: Wrap in try/catch or check device capability
- If animation timing is off, user might close sheet before success shows
  - **Mitigation**: Disable user interaction during animation, show overlay full-screen

---

## SUMMARY TABLE

| Task | Platform | Test File(s) | Breaking? | New Tests | Risk Level |
|------|----------|-------------|----------|-----------|------------|
| 01 | Web | NavBar.test.tsx | YES (text locators) | 5 | Medium |
| 02 | Web | LoginPage.test.tsx | NO | 5 | Low |
| 03 | Web | SummaryCards.test.tsx, AnalyticsPage.test.tsx | YES (card count) | 11 | Medium |
| 04 | Web | InventoryTable.test.tsx | NO | 10 | Low |
| 05 | Web | InventoryTable.test.tsx | YES (text assertions) | 5 | Low |
| 06 | Web | InventoryTable.test.tsx | NO | 7 | Low |
| 07 | Web | AddItemForm.test.tsx, InventoryPage.test.tsx | YES (error location) | 18 | Medium |
| 08 | Web | Toast.test.tsx, InventoryPage.test.tsx | NO (possibly) | 14 | **HIGH** |
| 09 | Web | EmptyState.test.tsx | NO | 8 | Low |
| 10 | Web | N/A (CSS only) | NO | 0 | None |
| 11 | iOS | N/A (UI setup) | NO | 0 | None |
| 12 | iOS | InventoryViewModelTests.swift | NO | 8 | Low |
| 13 | iOS | SalesViewModelTests.swift | NO | 7 | Low |
| 14 | iOS | AnalyticsViewModelTests.swift | NO | 10 | Medium |
| 15 | iOS | Model tests (minimal) | NO | 4 | Low |

---

## CRITICAL REGRESSION RISKS — DETAILED

### 1. **TASK 08: Undo Window Race Condition (HIGHEST PRIORITY)**

**Root Cause:**
The 5-second undo window requires careful state management:
- Item is optimistically deleted from cache (UI updated immediately)
- DELETE API call must be deferred 5 seconds
- If user clicks Undo within 5 seconds, restore item and cancel API call
- If user doesn't click Undo, fire API call after 5 seconds

**Test Complexity:**
Must test with fake timers (`vi.useFakeTimers()`) to control the 5-second window. Test scenarios:
1. Delete item → timer starts → advance 5000ms → API called
2. Delete item → click Undo after 2000ms → timer cancelled → API never called → item restored
3. Delete two items with overlapping undo windows → each has independent timer
4. Undo expiration → item removed from table after timer fires

**Implementation Risk:**
- If using `setTimeout` without proper cancellation, second delete might be cancelled by first delete's timer
- If React Query cache is not properly restored on Undo, item might show stale data
- If component unmounts before timer completes, cleanup must cancel pending API call

**Required Tests:**
```tsx
// EXAMPLE STRUCTURE (DO NOT implement, just structure)
test('delete item triggers 5-second undo window', async () => {
  vi.useFakeTimers()
  // 1. Delete item → verify removed from UI, toast shows
  // 2. Advance 2000ms → verify API not called yet
  // 3. Click Undo → verify restored to UI, API cancelled
  // 4. Verify item data is identical (all fields)
})

test('undo window expires → API call fires', async () => {
  vi.useFakeTimers()
  // 1. Delete item
  // 2. Advance 5000ms
  // 3. Verify DELETE API called with correct ID
  // 4. Verify item remains deleted from UI
})

test('multiple deletes with overlapping undo windows', async () => {
  vi.useFakeTimers()
  // 1. Delete item A → timer A starts
  // 2. Delete item B → timer B starts
  // 3. Advance 2500ms → click Undo on A only
  // 4. Verify A restored, B still deleted
  // 5. Advance to 5500ms → verify B delete API called, A's didn't
})
```

---

### 2. **TASK 03: Profit Margin Division by Zero**

**Root Cause:**
Formula: `totalProfit / totalRevenue * 100`

If `totalRevenue === 0`, result is `Infinity` or `NaN`.

**Test Requirement:**
```tsx
test('profit margin card shows "—" when totalRevenue is 0', () => {
  const summary = { totalProfit: 100, totalRevenue: 0, ... }
  render(<SummaryCards summary={summary} />)
  const marginCard = screen.getByTestId('card-profitMargin')
  expect(marginCard).toHaveTextContent('—')
})
```

**Risk:**
If guard clause is missing, card shows "Infinity%" or "NaN%", breaking accessibility and visual design.

---

### 3. **TASK 07: Inline Validation Message Positioning**

**Root Cause:**
Moving validation errors from form-level to inline beneath each field changes DOM structure.

Tests currently look for errors at form root:
```tsx
expect(screen.getByText(/name is required/i))  // Fails if error is nested
```

**Test Requirement:**
```tsx
test('validation error appears inline beneath name field', async () => {
  renderForm()
  await user.click(screen.getByRole('button', { name: /add item/i }))

  const nameInput = screen.getByLabelText(/name/i)
  const errorInField = within(nameInput.parentElement).queryByText(/name is required/i)
  expect(errorInField).toBeInTheDocument()
})
```

**Risk:**
If inline errors are added to a different container, test fails even though UX is correct.

---

### 4. **TASK 01: NavBar Text Locators with Hamburger Menu**

**Root Cause:**
If hamburger menu collapses navigation links into a drawer, screen.getByRole('link') may return drawer trigger instead of actual link.

**Test Requirement:**
```tsx
test('add item link accessible in drawer when hamburger expanded', async () => {
  renderNavBar('BUYER')
  const user = userEvent.setup()

  // Open drawer
  await user.click(screen.getByRole('button', { name: /menu/i }))

  // Link now visible in drawer
  const addItemLink = screen.getByRole('link', { name: /add item/i })
  expect(addItemLink).toBeVisible()
})
```

**Risk:**
If test doesn't account for drawer, it fails with "no element matching role 'link' with name 'Add Item'" even though link exists.

---

### 5. **TASK 12: iOS Search Performance**

**Root Cause:**
Filtering large item lists (`O(n)` per keystroke) without debounce causes lag.

**Test Requirement:**
```swift
func testSearchFilter_largeItemList_performsInUnder100ms() async {
  let largeList = (0..<10000).map { Item(...) }
  vm.items = largeList

  let start = CFAbsoluteTimeGetCurrent()
  vm.searchText = "gucci"
  let elapsed = CFAbsoluteTimeGetCurrent() - start

  XCTAssertLessThan(elapsed, 0.1)  // 100ms
}
```

**Risk:**
If search is not optimized, UI becomes unresponsive, poor user experience.

---

## RECOMMENDATIONS

### Immediate (Before Implementation)
1. **TASK 08 (Undo)**: Write comprehensive async tests with fake timers FIRST (TDD)
2. **TASK 03 (Profit Margin)**: Add division-by-zero guard and test explicitly
3. **TASK 07 (Inline Validation)**: Define exact DOM structure for errors before coding

### During Implementation
1. Run all affected test files: `npm test -- --run` after each task
2. Update test assertions immediately when DOM structure changes
3. Use `git diff booking-ui/src/{components,pages}/*.test.tsx` to track test changes
4. Keep breaking changes to 1 task at a time (avoid compound test failures)

### After Implementation
1. Full regression suite: `npm test -- --run`
2. Snapshot tests for styling (Tasks 01, 02, 06): verify visual changes match design
3. E2E tests with Playwright for undo flow (Task 08)
4. iOS simulator testing on device: haptics + animations (Task 15)

---

## TEST FILE CREATION CHECKLIST

**New test files NOT required** — all affected code has existing test files.

**Existing test files requiring updates:**
- [ ] booking-ui/src/components/NavBar.test.tsx (Task 01)
- [ ] booking-ui/src/pages/LoginPage.test.tsx (Task 02)
- [ ] booking-ui/src/components/SummaryCards.test.tsx (Task 03)
- [ ] booking-ui/src/pages/AnalyticsPage.test.tsx (Task 03)
- [ ] booking-ui/src/components/InventoryTable.test.tsx (Tasks 04, 05, 06)
- [ ] booking-ui/src/components/AddItemForm.test.tsx (Task 07)
- [ ] booking-ui/src/pages/InventoryPage.test.tsx (Tasks 07, 08)
- [ ] booking-ui/src/components/Toast.test.tsx (Task 08)
- [ ] booking-ui/src/components/EmptyState.test.tsx (Task 09)
- [ ] booking-ios/BookingTests/Features/InventoryViewModelTests.swift (Task 12)
- [ ] booking-ios/BookingTests/Features/SalesViewModelTests.swift (Task 13)
- [ ] booking-ios/BookingTests/Features/AnalyticsViewModelTests.swift (Task 14)

---

## CONCLUSION

**Total Breaking Tests:** 5 (Tasks 01, 03, 05, 07)
**Total New Test Cases:** ~97 test cases across all tasks
**Highest Risk:** Task 08 (Undo) — requires careful async/cache management
**Tasks with Zero Test Impact:** Tasks 10, 11, 15 (UI setup/CSS only)

Recommend **sequential implementation with test-first approach** (per CLAUDE.md). Write test cases for each task BEFORE implementation to catch edge cases early.
