## Investigation findings

When goods are received via the **Receiving Report → Receive** tab (`EnhancedGoodsReceivedForm`), local inventory (`components.stock_quantity` / `raw_materials.stock_quantity`) is **never incremented**. Two independent failures cause this.

### Root cause #1 — No local stock increment

`EnhancedGoodsReceivedForm.receiveMutation` does three things:
1. Inserts rows into `stock_movements`
2. Calls `increment_po_line_received` (updates the PO line counter only)
3. Invokes `sync-grn-to-autocount`

Nothing in this flow updates `components.stock_quantity` or `raw_materials.stock_quantity`.

There is a DB function `update_stock_quantity()` that *would* do it, but:
- It is **not attached as a trigger** anywhere (`information_schema.triggers` returns 0 rows for the `public` schema).
- Even if it were, its `IF/ELSIF` branches only handle `'product'`, `'raw_material'`, `'finished_good'` — it has **no branch for `'component'`**, which is the item_type used by every receipt.

Verified against live data: receipt of 2000 YAKULT (TLC00018) was logged on 2026-05-12, but `components.stock_quantity` is still 150. Same pattern for all recent receipts.

### Root cause #2 — AutoCount GRN sync endpoint is broken

The local stock could otherwise be backfilled by the 5-minute pg_cron AutoCount pull, but `sync-grn-to-autocount` is failing for every line:

```
AutoCount API error: No HTTP resource was found that matches the
request URI 'http://api.thelemonco.online/api/GoodsReceivedNote'.
No type was found that matches the controller named 'GoodsReceivedNote'.
```

The Backend `Backend.Api/Controllers/` folder has no `GoodsReceivedNoteController`. The endpoint simply does not exist, so AutoCount never records the GRN and the periodic pull never bumps stock either.

## Proposed fix

### A. Update local stock immediately on receipt (primary fix)

Inside `EnhancedGoodsReceivedForm.receiveMutation`, after inserting `stock_movements` and bumping `received_quantity`, increment the destination item's `stock_quantity` for every selected line:

```text
for each selected line:
  if item_type == 'raw_material':
    update raw_materials set stock_quantity = stock_quantity + qty where id = raw_material_id
  else:
    update components set stock_quantity = stock_quantity + qty where id = component_id
```

Use the `.select()` + `data.length > 0` pattern (per project memory) to catch any silent RLS failure, and surface a toast on error. Apply the same fix to `src/components/warehouse/GoodsReceivedForm.tsx` and `StockReceiptForm.tsx` if they share the gap (will verify during implementation).

Invalidate `["components"]` / `["raw-materials"]` query keys (already done).

### B. Note about AutoCount GRN sync (out of scope, flagged)

The `sync-grn-to-autocount` failures are a separate backend gap (missing `GoodsReceivedNoteController` on the AutoCount API server). This plan does **not** fix the C# backend, but the local stock fix above means receiving works end-to-end inside the app even while AutoCount GRN sync is broken. I will leave a clear console warning + toast when the sync call fails so it is visible, and recommend addressing the backend controller separately.

### Files to change

- `src/components/inventory/EnhancedGoodsReceivedForm.tsx` — add local stock increment block in mutation.
- `src/components/warehouse/GoodsReceivedForm.tsx` — same fix if it has the same gap.
- `src/components/warehouse/StockReceiptForm.tsx` — verify and patch if needed.

No DB migration, no edge function changes, no RLS changes (Warehouse/Admin already have UPDATE on both tables).
