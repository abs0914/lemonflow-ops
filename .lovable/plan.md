Allow Production to log/create orders for both **Products** (existing) and **Raw Materials** (new — e.g., Strawberry Puree, Mango Puree).

## Changes

### 1. Database (migration)
- `assembly_orders`: add `raw_material_id uuid` (nullable); make `product_id` nullable; add CHECK that exactly one of (`product_id`, `raw_material_id`) is set.

### 2. Log Production dialog (`LogProductionDialog.tsx`)
- Add an "Item type" toggle: **Product** / **Raw Material**.
- Product list = current (products with BOM).
- Raw Material list = all raw materials (sorted by name, showing SKU).
- Submit payload becomes `{ item_id, item_type: 'component' | 'raw_material', quantity, notes }`.

### 3. Production page (`Production.tsx`)
- `logProductionMutation` branches on `item_type`:
  - **component**: existing flow (update `components.stock_quantity`, sync to AutoCount).
  - **raw_material**: insert `stock_movements` (item_type `raw_material`, movement_type `assembly_produce`), update `raw_materials.stock_quantity` directly. **Skip AutoCount sync** (raw materials are local-only per project memory).
- `updateProductionMutation`: same branching for edits.
- `useProductionLogs`: also query `raw_materials` for unmatched item_ids and remove the hardcoded `eq("item_type","component")` filter so raw-material logs appear.

### 4. Create Assembly Order (`ProductionCreate.tsx`)
- Add item-type toggle (Product / Raw Material).
- Insert `assembly_orders` with either `product_id` or `raw_material_id` populated.
- Order list/detail components that display the order name will need to read from raw_materials when `raw_material_id` is set (will update `Production.tsx` order rendering accordingly).

## Out of scope
- BOM-driven stock reservation for raw-material outputs (current `reserve_stock_for_assembly` only looks up `bom_items.product_id`). Raw-material production will be loggable directly without auto-reservation; reservation/consumption stays a manual step for now. Can extend later if needed.
- AutoCount sync for raw-material production (raw materials are strictly local).
