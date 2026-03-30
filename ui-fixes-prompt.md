# UI Fixes + Record-Sale Enhancements

Read CONTEXT.md before starting. TDD always — write failing tests first, then implementation.

---

## 1. Uniform Action Buttons (Inventory + Sales pages)

**Files:** `booking-ui/src/pages/InventoryPage.tsx`, `booking-ui/src/pages/SalesPage.tsx`, `booking-ui/src/theme.css`

Define a single shared CSS class `.btn-action` in `theme.css` with explicit `min-width`, `height`, and padding using existing `--color-*`, `--font-*`, and `--radius-*` tokens. Apply `.btn-action` to **all** of these:
- Inventory page row buttons: Edit, Mark Sold, Delete
- Sales page header buttons: Import Sales, Record a Sale

Rules:
- No hardcoded hex, `rgb()`, or pixel values anywhere — use theme tokens or relative units only
- No inline `style` width/height overrides on buttons
- Header buttons must be vertically centered via flexbox

**Tests (Vitest + Testing Library — Pattern E):**
- Assert Edit, Mark Sold, and Delete buttons all have the `.btn-action` class
- Assert Import Sales and Record a Sale buttons both have the `.btn-action` class

---

## 2. Record Sale — Item Picker

**Files:** `booking-ui/src/pages/SalesPage.tsx`, `booking-ui/src/api/inventoryApi.ts`

In the "Record a Sale" form, replace any free-text item field (or add one if missing) with a `<select>` that fetches available inventory:

- Call `GET /api/v1/items?status=AVAILABLE` via `inventoryApi` (add the function if it doesn't exist)
- Each `<option>` label: `"name (brand)"` if `brand` is non-empty, else just `"name"`
- The selected item's `id` maps to the `itemId` field in `POST /api/v1/sales`
- The item picker is **required** — disable the submit button until an item is selected
- If the list is empty, show a disabled `<option>` with text `"No available items"` and keep submit disabled

**Tests (mock `inventoryApi.getItems` via `vi.mock()` — Pattern E):**
- Populated list: assert all item options render with correct labels
- Empty list: assert "No available items" option renders and submit is disabled
- Selection: assert choosing an option updates the form's `itemId` state

---

## 3. Record Sale — Platform Dropdown with "Add New"

**File:** `booking-ui/src/pages/SalesPage.tsx`

Replace the platform free-text input with a controlled `<select>`. Default options (in order): `Vestiaire`, `Poshmark`, `Ebay`, `Mercari`, then a final `＋ Add new platform…` option.

Behavior when `＋ Add new platform…` is selected:
- Reveal a text input below the dropdown
- User presses **Enter** or clicks a **"Add"** button to confirm
- On confirm: trim whitespace; if empty — reject silently (keep input open); if a duplicate of an existing option (case-insensitive) — reject silently; otherwise append to list and auto-select it
- User presses **Escape** or clicks outside — dismiss input without adding, revert dropdown to previous selection
- Store added platforms in component state only (no backend changes)

**Tests (vi.mock — Pattern E):**
- Assert default four options render
- Assert "＋ Add new platform…" option is present
- Assert selecting it reveals the text input
- Assert Enter with valid value adds platform and selects it
- Assert Enter with empty/whitespace value does not add
- Assert duplicate value (case-insensitive) does not add
- Assert Escape dismisses input without adding

---

## 4. UI Audit (Focused)

**Files:** all pages in `booking-ui/src/pages/`

Audit every page for the following specific issues and fix each one found:

1. **Buttons** — any button not using `.btn-action` (from Task 1) or a documented variant class
2. **Colors** — any hardcoded hex, `rgb()`, or named color not referencing a `--color-*` token
3. **Alignment** — any button row or header where items are not vertically centered
4. **Form inputs** — any input/select not using consistent padding or border tokens

For each fix, add a single-line comment: `/* audit-fix: <reason> */`

**Tests:** Add one Vitest smoke test per page (if not already present) asserting the page renders without throwing. Use Pattern E (wrap in `<AuthProvider><MemoryRouter>`, mock all API calls).

---

## Constraints

- **CSS:** Only `theme.css` custom properties for colors, fonts, radii. No hardcoded hex or inline pixel sizes.
- **State:** All new UI state in React component state — no `localStorage`.
- **Pattern E:** All frontend tests wrap renders in `<AuthProvider><MemoryRouter>` and mock API modules via `vi.mock()`.
- **Verify:** Run `cd booking-ui && npm test -- --run` — all tests must pass before finishing.
