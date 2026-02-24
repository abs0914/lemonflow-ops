

## Add Recommended Cost Price Field to Edit Inventory Dialog

### What Changes

Add a read-only "Recommended Cost Price" field in the Edit Inventory Dialog, positioned between the "Cost per Unit" row and the existing "Note" box (as shown in the screenshot). This field displays the highest cost ever recorded for the item but does **not** auto-update the cost per unit -- users must manually change it if desired.

### Database Changes

**Migration**: Add `recommended_cost_price` column to `components` and `raw_materials` tables.

```text
ALTER TABLE components ADD COLUMN recommended_cost_price numeric DEFAULT NULL;
ALTER TABLE raw_materials ADD COLUMN recommended_cost_price numeric DEFAULT NULL;
```

**Backfill**: Set initial values from the highest of `cost_per_unit` or max `unit_cost` from `stock_movements`.

**Trigger**: Create a trigger on `stock_movements` INSERT that updates `recommended_cost_price` on the parent item if the new `unit_cost` is higher. This only updates the recommended field -- it never touches `cost_per_unit`.

### UI Changes

**`src/components/inventory/EditInventoryDialog.tsx`**:
- Add a read-only "Recommended Cost Price" field in the grid row after "Cost per Unit", right before the Note box
- Display it with a muted background and a helper text: "Highest recorded purchase cost"
- The field is not editable -- it is informational only

**`src/types/inventory.ts`**:
- Add `recommended_cost_price: number | null` to `Component` and `RawMaterial` interfaces

### Layout (Edit Dialog)

```text
Unit *              | Cost per Unit
--------------------|--------------------
[Pcs]               | [8.1]

Recommended Cost Price
[8.1]  (read-only, muted background)
"Highest recorded purchase cost"

Note: Stock quantities cannot be changed here...
```

### Files Modified
- New database migration (schema + trigger + backfill)
- `src/types/inventory.ts` -- add field to interfaces
- `src/components/inventory/EditInventoryDialog.tsx` -- add read-only display field
- `src/integrations/supabase/types.ts` -- will auto-update with new column

