
# Production Tracking & Report

Add per-ingredient actual-used tracking to production logs, allow later adjustments, and surface a Daily Production Report grouped by produced item.

## 1. Production Log — Capture Actual Used at Log Time

Update the "Log Production" / "Complete Assembly" form so that after picking the produced item and quantity, the BOM expands into an editable table:

| Ingredient | SKU | Expected (BOM × qty) | Actual Used | Variance |

- Expected is auto-calculated from `bom_items.quantity × produced_qty`.
- Actual defaults to Expected; user can override per row.
- On submit, the backend consumes the **actual** quantity (not expected) from inventory.

## 2. Post-Log Adjustment

From the Production page, each log gets an "Adjust" action that opens the same ingredient table pre-filled with whatever was consumed last time. Saving creates a delta stock movement per changed line, restoring or deducting stock to match the new actual.

Allowed roles: Production, Warehouse, Admin (matches `log_production` permissions).

## 3. Daily Production Report

New page **Reports → Production** showing one row per produced item per day:

| Date | Item | SKU | Qty Produced | Material | Expected | Actual Used | Variance | Variance % |

- Default range: last 7 days, with date-range picker.
- Filters: produced item, material, role-aware (Admin/Production/Warehouse/CEO see all; others hidden from menu).
- Export to CSV.
- Click a row to drill into the underlying production logs.

## Technical Details

### Database (migration)
- Extend `log_production(p_item_type, p_item_id, p_quantity, p_notes, p_product_id, p_parent_raw_material_id, **p_actual_consumption jsonb DEFAULT NULL**)`.
  - `p_actual_consumption` shape: `[{ "item_type": "raw_material"|"component", "item_id": "uuid", "quantity": number }, ...]`.
  - When provided, override the BOM-computed `v_required` for matching rows; missing rows fall back to BOM expected.
  - Pre-flight availability check uses the actual qty.
  - Each `assembly_consume` stock_movement already links to the produce movement via `reference_id` — keep that linkage; add `expected_quantity` to `notes` (JSON) so we can compare without a new column, OR add nullable column `stock_movements.expected_quantity numeric` (cleaner — preferred).
- New RPC `adjust_production_consumption(p_produce_movement_id uuid, p_adjustments jsonb)`:
  - Verifies caller role (Admin/Warehouse/Production).
  - For each adjustment, finds the existing `assembly_consume` movement for that produce + item, computes delta = new_actual − current_actual, inserts a new `movement_type='assembly_adjust'` row with the delta (negative consumes more, positive returns stock), and updates the inventory table accordingly.
  - Add `'assembly_adjust'` to allowed `movement_type` values (it already accepts free-form text — confirm no CHECK constraint blocks it; if so, extend it).
- All new SQL ships in one migration; no new tables required.

### Frontend
- `src/components/production/LogProductionDialog.tsx` (or current form): add the BOM ingredients editable table; on submit pass `p_actual_consumption` array.
- New `src/components/production/AdjustConsumptionDialog.tsx`: opened from each row in the production logs list; calls `adjust_production_consumption` RPC.
- New page `src/pages/reports/ProductionReport.tsx` + route entry, with filters, table, CSV export. Add a "Production" tab/card to the existing Reports hub and gate visibility by role.
- Data source for the report: join `stock_movements` (produce + linked consume rows) with `components`/`raw_materials`/`products`/`user_profiles`, group by date and produced item.

### Out of scope
- No changes to AutoCount sync rules (produce remains synced to AutoCount, raw-material consumption stays local — same as today).
- No new pricing/costing recompute; report shows quantities only.
