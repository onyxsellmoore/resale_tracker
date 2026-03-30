# UX Implementation Plan — Booking App
> Reviewed by: QA Engineer · Senior Engineer · Senior UX Designer · PM
> All tasks follow TDD. Write tests first, then implementation.
> CSS: use only `--custom-properties` from `theme.css`. No hardcoded hex or px in JSX.

---

## How to Use This Document

Each task below is a self-contained prompt for Claude Code.
- **Read** = files the agent must read before touching anything.
- **Modify** = files the agent will change or create.
- **Goal** = plain-language description of what must be true when done.
- **Tests** = what tests must be written first, and which existing tests to update.
- **Notes** = reviewer flags the agent must not skip.

Tasks are ordered to avoid merge conflicts. Complete them in sequence.

---

## WEB TASKS

---

### T01 — Sticky Navbar + SVG Hamburger + CTA Hierarchy

**Read**
- `booking-ui/src/components/NavBar.tsx`
- `booking-ui/src/components/NavBar.css`
- `booking-ui/src/theme.css`

**Modify**
- `booking-ui/src/components/NavBar.tsx`
- `booking-ui/src/components/NavBar.css`

**Goal**
Make the `.navbar` element sticky so it stays at the top of the viewport as the page scrolls. Add a translucent glass effect behind it. The navbar must sit above all page content.

Replace the `☰` text character inside the hamburger button with an inline SVG containing three horizontal bars. When the mobile drawer is open (`drawerOpen === true`), the three bars must visually transform into an X shape using CSS transitions — no JavaScript animation. Do this by toggling a CSS class on the button based on `drawerOpen` state.

Reduce the visual weight of the "Add Item" navbar link so that "Record a Sale" reads as the primary CTA. The "Add Item" link must remain in the DOM and be fully clickable for BUYER and ADMIN roles — only its visual style changes. Style it as an outline/ghost button with a border but no filled background.

**Tests**
- Update `NavBar.test.tsx`: existing test for hamburger text `☰` will fail — update the assertion to match the SVG element.
- New test: clicking the hamburger button twice renders the drawer open then closed (behavior unchanged).
- New test: "Add Item" link is present and has a CSS class that visually distinguishes it from "Record a Sale".

**Notes**
- The `navbar-hamburger` button already exists with `aria-label="Menu"` and `aria-expanded` — preserve both attributes.
- The `drawerOpen` state already exists in `NavBar.tsx` — use it to drive the SVG animation class.
- Do not change any role-permission logic for which links render.

---

### T02 — Login Page: Vertical Centering + Brand Hero

**Read**
- `booking-ui/src/pages/LoginPage.tsx`
- `booking-ui/src/components/Form.css`
- `booking-ui/src/theme.css`

**Modify**
- `booking-ui/src/pages/LoginPage.tsx`
- `booking-ui/src/pages/LoginPage.css` *(create new)*

**Goal**
The login page currently renders near the top of the screen. Make the entire page content vertically and horizontally centered within the full viewport height.

Add a brand hero section directly above the existing form card. The hero must contain:
- The text "Inventory Ledger" rendered in `--font-display` (Playfair Display) at a large size, in `--color-gold`.
- A short tagline below it: "Your resale business, organized." in `--color-text-muted` at a small size.
- A subtle radial glow behind the hero text using `--color-gold-glow`.

Move every `style={{ }}` inline prop currently in `LoginPage.tsx` into `LoginPage.css` using CSS custom properties. The file `LoginPage.css` does not currently exist — create it and import it in `LoginPage.tsx`.

**Tests**
- Update `LoginPage.test.tsx`: if any test asserts on inline styles, update to assert on CSS class names instead.
- New test: the brand hero heading "Inventory Ledger" is present in the rendered output.
- New test: the tagline text renders beneath the heading.
- New test: the form card is still present and the submit button still triggers `handleSubmit`.

**Notes**
- The passkey login logic (`handleSubmit`, `beginPasskeyLogin`, `completePasskeyLogin`) must not be touched.
- The session-expired banner and error state logic must remain unchanged.
- The "No account yet? Set up your organization" link at the bottom of the form must remain.

---

### T03 — Analytics: Date Presets + Profit Margin Card

**Read**
- `booking-ui/src/pages/AnalyticsPage.tsx`
- `booking-ui/src/components/SummaryCards.tsx`
- `booking-ui/src/components/SummaryCards.css`
- `booking-ui/src/types/index.ts`
- `booking-ui/src/theme.css`

**Modify**
- `booking-ui/src/pages/AnalyticsPage.tsx`
- `booking-ui/src/components/SummaryCards.tsx`

**Goal**
In `AnalyticsPage`, add three preset buttons above the existing date inputs: "This Month", "Last Month", and "This Year". Clicking each button must update the `from` and `to` state values to the correct start/end dates for that period. The active preset button must receive a visual highlight (e.g. gold border or gold text). Switching to a custom date via the date inputs must deactivate the preset highlight.

In `SummaryCards`, add a seventh card with the label "Profit Margin". Compute its value client-side as `(totalProfit / totalRevenue) * 100`, formatted to one decimal place followed by `%`. If `totalRevenue` is exactly `0`, display `—` instead of a numeric value. Apply the same gold `summary-card-value-gold` class when profit margin is positive, and the loss class when it is negative.

**Tests**
- Update `SummaryCards.test.tsx`: the existing test that asserts 6 cards will now find 7 — update the count assertion.
- New test: when `totalRevenue` is `0`, the Profit Margin card displays `—`.
- New test: when `totalRevenue` is positive, the card displays a correctly formatted percentage.
- Update `AnalyticsPage.test.tsx`: add test that clicking "This Month" sets `from` to the first day of the current month and `to` to the last day.

**Notes**
- `AnalyticsSummary` type in `types/index.ts` already has `totalProfit: number` and `totalRevenue: number` — no type changes needed.
- The preset date logic is purely client-side state. No new API calls.
- The existing "From" / "To" date inputs must remain fully functional after this change.

---

### T04 — Inventory Table: Debounced Text Search

**Read**
- `booking-ui/src/components/InventoryTable.tsx`
- `booking-ui/src/components/InventoryTable.css`

**Modify**
- `booking-ui/src/components/InventoryTable.tsx`
- `booking-ui/src/components/InventoryTable.css`

**Goal**
Add a text input above the existing status filter dropdown. The input searches inventory items by name or brand (case-insensitive). The filtering must be debounced by 300ms — do not re-filter on every keystroke. Implement the debounce with a local `useEffect` and a second state variable for the debounced value; do not add an external library.

The search filter must be applied after the status filter and before the sort, so all three can compose cleanly.

When a search is active and no items match the current query, render an inline empty state inside the table container: "No items matching '[searchQuery]'" as the message, with a "Clear" button that resets the search input to empty.

**Tests**
- Update `InventoryTable.test.tsx`: verify search input is present in the DOM.
- New test: after typing a query, only items whose name or brand contains that string are rendered.
- New test: the empty state message appears and contains the query string when no results match.
- New test: clicking "Clear" empties the search input and restores all (status-filtered) items.

**Notes**
- Row hover styles (`tbody tr:hover`) already exist in `InventoryTable.css` — do not duplicate them.
- The status filter dropdown and sort behavior must remain fully functional alongside search.
- The `sorted` variable is the final filtered+sorted array used in the table render — apply search to `filtered` before it feeds into `sorted`.

---

### T05 — Status Badge: Capitalization + Dot Indicator

**Read**
- `booking-ui/src/components/InventoryTable.tsx`
- `booking-ui/src/components/InventoryTable.css`

**Modify**
- `booking-ui/src/components/InventoryTable.tsx`
- `booking-ui/src/components/InventoryTable.css`

**Goal**
Change the text displayed inside each status badge from all-caps to title case: `AVAILABLE` renders as "Available" and `SOLD` renders as "Sold". The underlying `item.status` value passed to `data-testid` and `className` lookup must remain the original uppercase string — only the visible text changes.

Add a small filled dot before the badge text via a CSS `::before` pseudo-element. The dot must be approximately 6px in diameter. Use `--color-profit` (green) for the Available badge dot and `--color-text-muted` (gray) for the Sold badge dot. Do not use color alone to convey meaning — the text label must remain.

**Tests**
- Update `InventoryTable.test.tsx`: any assertion checking for `"AVAILABLE"` or `"SOLD"` badge text must be updated to `"Available"` and `"Sold"`.
- New test: the `data-testid` attribute on each badge still uses the original uppercase status value (regression check).

**Notes**
- The `badgeClass` lookup record uses `item.status` as the key — this must not be changed.
- The `status` field sent to the backend and stored in `ItemDTO` is unchanged.

---

### T06 — Delete Confirmation: Red Row State

**Read**
- `booking-ui/src/components/InventoryTable.tsx`
- `booking-ui/src/components/InventoryTable.css`
- `booking-ui/src/theme.css`

**Modify**
- `booking-ui/src/components/InventoryTable.tsx`
- `booking-ui/src/components/InventoryTable.css`

**Goal**
When a row's item ID matches `confirmingDeleteId`, apply a CSS class to that `<tr>` that gives it a muted red background tint (a translucent value derived from `--color-loss`, e.g. `rgba` at low opacity). This visually signals the row is in a destructive state.

The "Yes, delete" button must be styled as a filled red destructive button. The "Cancel" button must be styled as a plain ghost/outline button. All confirmation UI must fit inside the existing Actions cell — do not add any div that expands the row height beyond a single row's worth of buttons.

Add CSS classes `row-delete-confirm`, `btn-confirm-delete` to the stylesheet rather than using inline styles.

**Tests**
- Update `InventoryTable.test.tsx`: if any test clicks "Delete" and then asserts a confirmation prompt — update it to expect the new button labels and styling classes.
- New test: after clicking the initial Delete button, the row receives the `row-delete-confirm` class.
- New test: clicking "Yes, delete" calls `onDelete` with the correct item ID.
- New test: clicking "Cancel" removes the `row-delete-confirm` class (confirmingDeleteId resets).

**Notes**
- The two-step safety confirmation flow must remain — this is an ADMIN-only destructive action. Do not reduce the number of clicks required to delete.
- The current `confirmingDeleteId` state already exists in `InventoryTable.tsx` — use it.

---

### T07 — AddItemForm: Animated Panel + Save & Add Another + Inline Validation

**Read**
- `booking-ui/src/components/AddItemForm.tsx`
- `booking-ui/src/pages/InventoryPage.tsx`
- `booking-ui/src/components/Form.css`
- `booking-ui/src/theme.css`

**Modify**
- `booking-ui/src/components/AddItemForm.tsx`
- `booking-ui/src/pages/InventoryPage.tsx`
- `booking-ui/src/theme.css`

**Goal**
In `theme.css`, define a `@keyframes slideInRight` animation that starts at `translateX(24px)` and `opacity: 0` and ends at `translateX(0)` and `opacity: 1`. Apply this animation via a CSS class to the side-panel container `<div>` in `InventoryPage.tsx` so the form panel slides in when it mounts.

In `AddItemForm.tsx`, add a secondary "Save & Add Another" button. When clicked, this button must submit the form exactly like the primary submit, and — on success — reset all form field state (name, brand, category, condition, purchasePrice, purchaseDate, description, notes, and any error state) back to empty/default values without calling `onItemAdded` to close the panel. The `onItemAdded` callback is only triggered by the primary submit button.

Move validation error messages so each one appears immediately beneath the input it describes, not as a single block at the top of the form. If a field has no error, nothing renders beneath it.

**Tests**
- Update `AddItemForm.test.tsx`: any test asserting the form closes after submit should verify it only closes via the primary submit path, not "Save & Add Another".
- New test: clicking "Save & Add Another" on a valid form calls the API and resets all fields without closing the panel.
- New test: a validation error for the "name" field renders immediately after the name input, not at the form top.

**Notes**
- The `onItemAdded` prop is called by the parent `InventoryPage` to invalidate the query cache and show a toast. "Save & Add Another" must also trigger a cache invalidation — either call a lightweight version of the handler or trigger `queryClient.invalidateQueries` directly inside the form.
- Errors state must also be cleared on "Save & Add Another".

---

### T08 — Toast: Undo Action + Optimistic Delete in InventoryPage

**Read**
- `booking-ui/src/components/Toast.tsx`
- `booking-ui/src/components/Toast.css`
- `booking-ui/src/pages/InventoryPage.tsx`

**Modify**
- `booking-ui/src/components/Toast.tsx`
- `booking-ui/src/components/Toast.css`
- `booking-ui/src/pages/InventoryPage.tsx`

**Goal**
Add two optional props to `Toast`: `onUndo?: () => void` and `undoLabel?: string` (default label: "Undo"). When `onUndo` is provided, render a text button inside the toast (styled gold, no border) that calls `onUndo` when clicked. The undo button must appear before the dismiss `✕` button.

In `InventoryPage`, refactor `handleDeleteItem` to use an optimistic delete flow:
1. Immediately remove the item from the TanStack Query cache using `queryClient.setQueryData`.
2. Show a Toast with the `onUndo` prop set — the toast duration should be 5 seconds.
3. Store the pending delete in a `useRef` (a `setTimeout` ref and the item snapshot).
4. If the user clicks Undo before the toast auto-dismisses: cancel the timeout via the ref, restore the item in the cache via `queryClient.setQueryData`, and clear the undo state.
5. If the toast auto-dismisses: call the actual `deleteItem` API.
6. If the API call fails after the undo window: show an error toast and restore the item in the cache.

**Tests**
- Update `Toast.test.tsx`: existing snapshot tests will need to account for the new optional props — they are optional, so existing tests that don't pass them must still pass.
- New test: when `onUndo` is provided, an "Undo" button renders inside the toast.
- New test: clicking "Undo" calls `onUndo` and closes the toast.
- Update `InventoryPage.test.tsx`: the delete test should now verify the item disappears from the list immediately (optimistic), and reappears if undo is clicked.
- New test: if undo is not clicked within 5 seconds, `deleteItem` is called.

**Notes**
- Race condition guard: the undo action must check whether the timeout has already fired before attempting to restore the cache. Use the ref to determine this.
- The existing non-undo Toast usage throughout the app (e.g. "Item added to inventory") must continue to work without any `onUndo` prop.

---

### T09 — Empty State: Icon Prop + Improved Copy Across Pages

**Read**
- `booking-ui/src/components/EmptyState.tsx`
- `booking-ui/src/components/EmptyState.css`
- `booking-ui/src/pages/InventoryPage.tsx`
- `booking-ui/src/pages/SalesPage.tsx`
- `booking-ui/src/pages/AnalyticsPage.tsx`

**Modify**
- `booking-ui/src/components/EmptyState.tsx`
- `booking-ui/src/components/EmptyState.css`
- `booking-ui/src/pages/InventoryPage.tsx`
- `booking-ui/src/pages/SalesPage.tsx`
- `booking-ui/src/pages/AnalyticsPage.tsx`

**Goal**
Add an optional `icon?: ReactNode` prop to `EmptyState`. When provided, render it centered above the `<h3>` title. Add appropriate spacing in `EmptyState.css`. The icon can be any `ReactNode` — a Unicode emoji in a `<span>`, an SVG, or any element. The component must remain fully functional without an icon.

Update every `EmptyState` usage in the three page files with a relevant icon and clearer copy:
- Inventory (no items): icon of a box or package; title "No items yet"; description "Add your first item to start tracking inventory"; action button "Add Item" (existing).
- Inventory (search no results): this state lives in `InventoryTable.tsx` from T04 — pass an icon (magnifying glass) with the message.
- Sales (no sales): icon of a tag or price label; title "No sales recorded"; description "Mark an available item as sold to record your first sale"; action links to `/inventory`.
- Analytics (no data): icon of a chart; title "No data for this period"; description "Try a wider date range or record a sale first."

**Tests**
- Update `EmptyState.test.tsx`: add test that when `icon` prop is passed, the icon content renders above the title.
- New test: `EmptyState` renders correctly without the `icon` prop (regression).

**Notes**
- Do not import any icon library. Use simple Unicode characters or inline SVG.
- The `icon` prop is `ReactNode`, not a string — the caller decides what to render.

---

### T10 — Inline Style Extraction (CSS Refactor, No Visual Change)

**Read**
- `booking-ui/src/components/AppLayout.tsx`
- `booking-ui/src/pages/LoginPage.tsx`
- `booking-ui/src/pages/InventoryPage.tsx`
- `booking-ui/src/pages/SalesPage.tsx`
- `booking-ui/src/pages/AnalyticsPage.tsx`
- `booking-ui/src/theme.css`

**Modify**
- `booking-ui/src/components/AppLayout.tsx`
- `booking-ui/src/components/AppLayout.css` *(create new)*
- `booking-ui/src/pages/InventoryPage.tsx`
- `booking-ui/src/pages/InventoryPage.css` *(create new)*
- `booking-ui/src/pages/SalesPage.tsx`
- `booking-ui/src/pages/SalesPage.css` *(create new)*
- `booking-ui/src/pages/AnalyticsPage.tsx`
- `booking-ui/src/pages/AnalyticsPage.css` *(create new)*
- `booking-ui/src/pages/LoginPage.tsx` *(already modified in T02 — ensure LoginPage.css is complete)*

**Goal**
Move every remaining `style={{ }}` inline prop in the above files into co-located CSS files. Replace hard-coded pixel values and layout properties with CSS classes that use `--custom-properties` from `theme.css` where applicable. After this task, no numeric px values or hex color values should appear inside any `style={{ }}` prop in these files.

This is a pure refactor. No layout, spacing, or color may change visually.

**Tests**
- No new tests required.
- Run the existing full test suite after this task and confirm zero regressions. This is the primary verification step.

**Notes**
- `LoginPage.css` was already created in T02 — check that all inline styles in `LoginPage.tsx` were covered there. Fill in any gaps here.
- Do not touch `theme.css` in this task — only consume its variables.
- CSS files for `AnalyticsPage`, `SalesPage`, and `InventoryPage` do not currently exist and must be created.

---

## iOS TASKS

---

### T11 — iOS Tab Bar Dark Theme

**Read**
- `booking-ios/Booking/BookingApp.swift`
- `booking-ios/Booking/Views/MainTabView.swift`
- `booking-ios/Booking/Theme/AppTheme.swift`

**Modify**
- `booking-ios/Booking/BookingApp.swift`

**Goal**
The iOS tab bar currently shows a system-default appearance that does not match the app's dark theme. Configure the tab bar appearance so it uses a solid dark background matching the app's background color (`#080f08`).

In `BookingApp.swift`, add an `init()` to the `BookingApp` struct. Inside `init()`, create a `UITabBarAppearance` instance, configure it as opaque with the background color set to the UIColor equivalent of `#080f08`, and assign it to both `UITabBar.appearance().standardAppearance` and `UITabBar.appearance().scrollEdgeAppearance`. The `.tint(AppTheme.Colors.gold)` modifier is already applied in `MainTabView` and must not be changed.

**Tests**
- No unit tests required — this is a UIKit appearance configuration with no testable logic.

**Notes**
- Use `UITabBar.appearance()` (not a SwiftUI modifier) so the appearance applies globally before the first tab renders.
- The App struct does not currently have an `init()` — add one. This is valid in `@main App` conformance.
- Do not change `MainTabView.swift`.

---

### T12 — iOS Inventory List: Purchase Price, Search, Swipe Sell, Badge Polish

**Read**
- `booking-ios/Booking/Features/Inventory/ItemListView.swift`
- `booking-ios/Booking/Features/Inventory/InventoryViewModel.swift`
- `booking-ios/Booking/Theme/AppTheme.swift`
- `booking-ios/Booking/Features/Sales/RecordSaleSheet.swift`

**Modify**
- `booking-ios/Booking/Features/Inventory/ItemListView.swift`

**Goal**
Make four improvements to `ItemListView`:

**1. Purchase price in rows.** In each list row `HStack`, show the item's purchase price right-aligned. The left side of the row holds the existing name+brand `VStack`. The right side shows the purchase price formatted as currency using `AppTheme.Typography.bodySmall` in `AppTheme.Colors.textMuted`. Keep the row to a maximum of two text lines to avoid dense layout.

**2. Client-side search.** Add `@State private var searchText = ""` and attach `.searchable(text: $searchText, prompt: "Search name or brand")` to the `List`. Compute a local `filteredItems` variable from `vm.items`, filtering case-insensitively on `item.name` and `item.brand` when `searchText` is not empty. The `List` renders `filteredItems`, not `vm.items` directly.

**3. Leading swipe "Sell" action.** On rows where `item.status == "AVAILABLE"`, add a `.swipeActions(edge: .leading)` action labeled "Sell" with a dollar sign SF Symbol icon and a gold background tint. Add `@State private var sellItem: Item?` to the view. When the Sell swipe action is tapped, set `sellItem = item` and present `RecordSaleSheet` as a `.sheet(item: $sellItem)`. The sheet must receive both `vm` (as `SalesViewModel` — note: you will need to inject this or create it) and `inventoryVM`. Check how `RecordSaleSheet` is already presented in `SalesListView` for the existing initialization pattern.

**4. StatusBadge improvements.** In the `StatusBadge` struct, change the displayed text from the raw uppercase status string to title case ("Available" for "AVAILABLE", "Sold" for "SOLD"). Add a small filled `Circle` (frame 6×6) before the text label as a dot — use `AppTheme.Colors.profit` for Available and `AppTheme.Colors.textMuted` for Sold.

**Tests**
- Update `InventoryViewModelTests.swift`: if any test asserts on the full items array, ensure `filteredItems` filtering logic is also tested.
- New test: `filteredItems` returns only items matching the search query by name.
- New test: `filteredItems` returns only items matching the search query by brand.
- New test: `filteredItems` returns all items when `searchText` is empty.

**Notes**
- The existing trailing swipe delete action for ADMIN role must remain unchanged.
- The `SalesViewModel` needed for the Sell sheet: check `SalesListView` for how it receives `SalesViewModel` and replicate the pattern. You may need to add a `@StateObject private var salesVM = SalesViewModel()` to `ItemListView` if no other injection path exists.
- `item.purchasePrice` is a `Decimal` on the iOS model — format it using `currencyFormatted()` on `NSDecimalNumber`.

---

### T13 — iOS Sales List: Search + Profit Arrow Icon

**Read**
- `booking-ios/Booking/Features/Sales/SalesListView.swift`
- `booking-ios/Booking/Features/Sales/SalesViewModel.swift`
- `booking-ios/Booking/Theme/AppTheme.swift`

**Modify**
- `booking-ios/Booking/Features/Sales/SalesListView.swift`

**Goal**
Add `@State private var searchText = ""` and `.searchable(text: $searchText, prompt: "Search platform or item")` to `SalesListView`. Compute a local `filteredSales` from `vm.sales`, filtering case-insensitively on `sale.platform` when `searchText` is not empty. The `List` renders `filteredSales`.

In each sale row's `HStack`, the profit amount is already displayed with color coding (green/red). Add an SF Symbol image directly before the profit `Text`: use `"arrow.up"` when `sale.profit.value >= 0` and `"arrow.down"` when it is negative. Apply the same `foregroundStyle` to the image as the text, so color and icon are consistent. This ensures the profit direction is communicated with both color and icon (accessibility).

**Tests**
- New test: `filteredSales` returns only sales whose platform matches the search query.
- New test: `filteredSales` returns all sales when `searchText` is empty.

**Notes**
- Profit color coding already exists in the current `SalesListView` — do not change it.
- If `sale.itemName` is available on `SaleDTO`, also filter by item name in addition to platform to match the web behavior.

---

### T14 — iOS Analytics: Date Presets + Profit Margin Card

**Read**
- `booking-ios/Booking/Features/Analytics/AnalyticsView.swift`
- `booking-ios/Booking/Features/Analytics/AnalyticsViewModel.swift`
- `booking-ios/Booking/Models/AnalyticsSummary.swift`
- `booking-ios/Booking/Theme/AppTheme.swift`

**Modify**
- `booking-ios/Booking/Features/Analytics/AnalyticsView.swift`
- `booking-ios/Booking/Features/Analytics/AnalyticsViewModel.swift`

**Goal**
**In `AnalyticsViewModel`:** Add an enum `DatePreset` with cases `thisMonth`, `lastMonth`, `allTime`. Add a `func applyPreset(_ preset: DatePreset)` that computes the correct `from` and `to` `Date` values using `Calendar.current` (e.g. start/end of current month for `thisMonth`; start/end of previous calendar month for `lastMonth`; a distant past date to `Date()` for `allTime`), sets `self.from` and `self.to`, and then calls `fetchAnalytics()` as a `Task`.

**In `AnalyticsView`:** Add `@State private var selectedPreset: DatePreset? = .thisMonth` and a `Picker` with `.pickerStyle(.segmented)` showing labels "This Month", "Last Month", "All Time". Place it above the existing date pickers in the `VStack`. When the selected segment changes, call `vm.applyPreset(selectedPreset)`. Switching the manual date pickers should set `selectedPreset = nil` to deactivate the preset highlight.

**Profit Margin card:** Add a fifth `SummaryCard` below the existing four in the `LazyVGrid`. Title: "Profit Margin". Value: compute `(totalProfit.value / totalRevenue.value * 100)` as a `Decimal`, then format to one decimal place with a `%` suffix. Guard against divide-by-zero: if `totalRevenue.value == 0`, display `"—"`. Color: use `AppTheme.Colors.profit` when margin is positive, `AppTheme.Colors.loss` when negative.

**Tests**
- Update `AnalyticsViewModelTests.swift`: existing tests mock `AnalyticsSummary` — ensure mock data includes valid `totalRevenue` and `totalProfit` for the margin calculation.
- New test: `applyPreset(.thisMonth)` sets `from` to the first day of the current month.
- New test: `applyPreset(.lastMonth)` sets `from` to the first day of the previous month.
- New test: profit margin card shows `"—"` when `totalRevenue.value == 0`.

**Notes**
- `MoneyDecimal.value` is a `Decimal`. The margin calculation must use `Decimal` arithmetic, not `Double`, to avoid floating-point errors.
- `AnalyticsSummary` currently has `totalRevenue`, `totalProfit`, `totalSales`, `averageProfit`, `salesByPlatform` — no model changes needed.

---

### T15 — iOS Haptic Feedback + Success Animation on Submit

**Read**
- `booking-ios/Booking/Features/Inventory/AddItemSheet.swift`
- `booking-ios/Booking/Features/Sales/RecordSaleSheet.swift`
- `booking-ios/Booking/Theme/AppTheme.swift`

**Modify**
- `booking-ios/Booking/Features/Inventory/AddItemSheet.swift`
- `booking-ios/Booking/Features/Sales/RecordSaleSheet.swift`

**Goal**
In `AddItemSheet`, after `vm.addItem` completes and `vm.validationError == nil` (success):
1. Fire `UIImpactFeedbackGenerator(style: .medium).impactOccurred()`.
2. Set `@State private var showSuccess = false` to `true`.
3. Overlay a full-screen centered success indicator: `Image(systemName: "checkmark.circle.fill")` in `AppTheme.Colors.gold` at a large font size. Animate it: scale from `0.5` to `1.0` and opacity from `0` to `1`, then fade out — all within `0.6` seconds total. Use SwiftUI's `withAnimation` and a `DispatchQueue.main.asyncAfter` delay to auto-set `showSuccess = false` after `0.6s`, at which point call `dismiss()`.
4. Do not call `dismiss()` directly in the current position — only call it after the animation completes.

Apply the identical pattern to `RecordSaleSheet`. After `vm.recordSale(...)` returns `true` (success path, currently at line 68 in `RecordSaleSheet.swift`): trigger haptic, show the same checkmark overlay, then dismiss after animation.

**Tests**
- No unit tests required for haptic or animation (UIKit haptics and SwiftUI animations are not unit-testable).
- Ensure the existing success path logic in both sheets is not broken: `AddItemSheet` should still call `vm.addItem` with the correct arguments; `RecordSaleSheet` should still call `inventoryVM.fetchItems()` before dismissing.

**Notes**
- `showSuccess` state drives a `.overlay` modifier on the outermost `NavigationStack` or `ScrollView`. Use `.overlay` so it covers the full sheet content.
- The `withAnimation(.easeInOut(duration: 0.3))` should drive the scale+opacity transition. A `DispatchQueue.main.asyncAfter(deadline: .now() + 0.6)` fires dismiss after the animation completes.
- Do not add haptics on validation failure — only on success.

---

## Execution Order

| # | Task | Layer | Risk |
|---|------|-------|------|
| 1 | T10 | Web | Low — pure CSS refactor, zero logic |
| 2 | T05 | Web | Low — display text + CSS only |
| 3 | T01 | Web | Low — NavBar polish |
| 4 | T02 | Web | Low — LoginPage layout |
| 5 | T06 | Web | Low — delete row styling |
| 6 | T04 | Web | Medium — new search state in InventoryTable |
| 7 | T09 | Web | Low — EmptyState prop addition |
| 8 | T03 | Web | Medium — new card in SummaryCards |
| 9 | T07 | Web | Medium — form behavior change |
| 10 | T08 | Web | High — optimistic delete + undo flow |
| 11 | T11 | iOS | Low — UIAppearance config |
| 12 | T12 | iOS | Medium — multiple view changes |
| 13 | T13 | iOS | Low — search + icon addition |
| 14 | T14 | iOS | Medium — new VM enum + view changes |
| 15 | T15 | iOS | Low — animation overlay |

---

## QA Sign-Off Checklist

After all tasks are complete, run these checks before merging:

- [ ] `cd booking-ui && npm test -- --run` — zero failures
- [ ] `cd booking-api && ./mvnw test` — zero failures (backend untouched)
- [ ] `cd booking-ui && npm run build` — zero TypeScript errors
- [ ] Manual: log in as BUYER — "Add Item" link visible in navbar, functional
- [ ] Manual: log in as SELLER — "Record a Sale" link visible, "Add Item" not visible
- [ ] Manual: log in as ADMIN — both links visible, delete on inventory works with undo toast
- [ ] Manual: Analytics page — all three preset buttons set correct date ranges
- [ ] Manual: Profit Margin card shows `—` on a fresh account with no sales
- [ ] Manual: InventoryTable search filters by name and by brand
- [ ] Manual: Status badges show "Available" / "Sold" (not "AVAILABLE" / "SOLD")
- [ ] iOS: Tab bar background is dark, selected tab is gold
- [ ] iOS: Swipe "Sell" on available item opens RecordSaleSheet
- [ ] iOS Simulator: Face ID enrolled → add item → checkmark animation fires → sheet dismisses
