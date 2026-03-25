

# Franchisee Store Orders: Hide Quick Entry + Add Print/PDF to Order Detail

## Summary
1. Hide the "Quick Entry" button on the Store Orders list page for franchisee users (users whose assigned stores are all franchisee type).
2. Add Print and Download PDF buttons to the Store Order Detail page.

## Changes

### 1. Hide Quick Entry for Franchisee Users (`src/pages/StoreOrders.tsx`)
- Check if the current user's assigned stores are all franchisee type using `userStores` data
- Conditionally render the Quick Entry button only when the user has at least one non-franchisee store or is an operational role
- Operational roles (Admin, Warehouse, Fulfillment, Production, Accounting) always see Quick Entry

### 2. Add Print & PDF to Order Detail (`src/pages/StoreOrderDetail.tsx`)
- Add a Print button and a Download PDF button to the action bar
- Import `Printer` and `Download` icons from lucide-react
- Create a print portal (following existing `po-print-portal` pattern) with a `SalesOrderPrintView` component

### 3. Create `SalesOrderPrintView` Component (`src/components/store-orders/SalesOrderPrintView.tsx`)
- New component that renders a print-friendly layout via React Portal (appended to `document.body`, hidden on screen, visible on print)
- Displays: order number, store name, order date, delivery date, status, description, and a table of line items with totals
- Uses the same portal pattern as `POPrintView` with a dedicated `#so-print-portal` element
- Print CSS hides `#root` and shows only `#so-print-portal`

### 4. PDF Download Logic (`src/pages/StoreOrderDetail.tsx`)
- Use `window.print()` for the Print button (leveraging the print portal)
- For PDF download, use the same `window.print()` approach (browser print-to-PDF) — simplest approach with no extra dependencies
- Alternatively, generate a canvas-based PDF using `html2canvas` + `jspdf` if a direct download is needed — but `window.print()` is sufficient for now

## Technical Notes
- The print portal pattern ensures clean printouts without dashboard chrome
- Franchisee detection: if `!isOperational`, check `userStores?.every(s => s.stores?.store_type === 'franchisee')`
- Both Print and Download PDF will trigger `window.print()` — the browser's Save as PDF option handles the download case

