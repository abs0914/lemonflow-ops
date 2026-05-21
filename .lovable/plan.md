## Goal
Flag in real time when a franchisee enters a quantity greater than what's actually available (on-hand minus reserved), and block submit until quantities are valid.

## Where it applies
- `src/components/store-orders/ItemSelector.tsx` (Create Sales Order — add-item flow)
- `src/components/store-orders/OrderLineForm.tsx` (already-added lines list)
- `src/pages/StoreOrderCreate.tsx` (Submit button gating)
- `src/pages/StoreOrderQuickEntry.tsx` (Quick Entry parsed lines)

## Available-stock definition
`available = stock_quantity - reserved_quantity` from the `components` table (matched by `autocount_item_code` or `sku`). Already exposed in `useInventoryItems` — we'll add `reserved_quantity` to that hook's select and compute `available` client-side.

## UX
1. **ItemSelector (Add Item form)**
   - Show `Available: N` next to the Quantity field (red when `qty > available`, muted otherwise).
   - If `qty > available`: show inline destructive message "Only N available — reduce quantity." Disable the "Add Item to Order" button.
   - If `available <= 0`: dropdown still lists the item but tags it "Out of stock"; Add button disabled.

2. **OrderLineForm (already-added lines)**
   - For each line, fetch its current available qty and render a red badge "Exceeds stock (avail: N)" when `line.quantity > available`.
   - Lines that exceed stock get a subtle red border.

3. **StoreOrderCreate — Submit gating**
   - Compute `hasStockIssue = lines.some(l => l.quantity > availableFor(l))`.
   - Disable "Submit Order" when `hasStockIssue`; tooltip explains why. "Save Draft" stays enabled (drafts don't reserve stock).
   - Keep the existing server-side `reserve_stock_for_sales_order` block as the final safety net.

4. **Quick Entry**
   - In the parsed-items preview table, add an "Available" column and flag rows where `qty > available` in red. Disable "Submit Order" when any row is flagged. "Save as Draft" remains enabled.

## Technical details
- Extend `useInventoryItems` to return `reserved_quantity` and a derived `available_quantity = stock_quantity - reserved_quantity`. Keep the existing `.gt("stock_quantity", 0)` filter but UI computes against `available`.
- Add a small helper `getAvailable(itemCode, items)` shared by ItemSelector, OrderLineForm, and Quick Entry to look up by `autocount_item_code` or `sku`.
- No DB / RLS changes. No changes to the reservation RPC.
- Applies to all order creators (Franchisee, Store, Finance, Admin, etc.) — it's a UX guard, not role-specific.

## Out of scope
- Backorder/partial-fulfillment flow.
- Auto-capping the quantity.
- Changing the existing reservation timing or AutoCount sync behavior.
