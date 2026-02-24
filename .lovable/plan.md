

## Include Pricing in Inventory Export and Import

### What Changes

Add **Price** and **Cost Per Unit** columns to both the inventory CSV export and CSV import so that pricing data can be bulk-managed alongside other inventory fields.

### Changes

#### 1. Export (src/pages/Inventory.tsx)
- Add "Price" and "Cost Per Unit" to the CSV header row
- Include `item.price` and `item.cost_per_unit` values in each exported row

#### 2. Import (src/components/inventory/ImportInventoryDialog.tsx)
- Add `price` and `cost_per_unit` to the `ParsedItem` interface
- Detect "price" and "cost per unit" (or "cost_per_unit") columns during header parsing
- Parse the numeric values from the CSV data rows
- Include `price` and `cost_per_unit` in both the update and insert operations to Supabase
- Update the dialog description to mention the new optional columns

### Technical Details

**Export header change:**
```
Before: SKU, AutoCount Code, Name, Item Group, Item Type, Stock Qty, Reserved, Available, Unit, Low Stock Threshold
After:  SKU, AutoCount Code, Name, Item Group, Item Type, Stock Qty, Reserved, Available, Unit, Price, Cost Per Unit, Low Stock Threshold
```

**Import header detection:** Will match columns named "price" and headers containing "cost" (e.g., "cost per unit", "cost_per_unit").

**Files modified:**
- `src/pages/Inventory.tsx` -- export function
- `src/components/inventory/ImportInventoryDialog.tsx` -- import parsing and upsert logic

