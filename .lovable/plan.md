## Goal

Make order numbers visible in the Store Order Consolidation report at two levels:
1. **Per delivery date** — chips in each delivery card header
2. **Per item line** — new "Orders" column showing which order(s) contributed to that line's released qty

## Changes — `src/components/reports/StoreOrderConsolidationReport.tsx`

**Data model**
- Extend `DeliveryGroup` with `order_numbers: Set<string>` (for header chips).
- Extend `AggItem` with `orders: Map<string, number>` keyed by `order_number` → qty contributed (for per-item column and tooltip).

**Aggregation loop**
- When adding a line, push `order.order_number` into both the group's `order_numbers` set and the item's `orders` map (summing qty per order number).

**UI — delivery header**
- Below the existing "Stores: …" line, add an "Orders: …" line rendering each order number as a small `Badge variant="outline"` chip. Wraps naturally.

**UI — items table**
- Add an "Orders" column between "Item Name" and "UOM".
- Render comma-separated order numbers (e.g. `SO-001, SO-002`). If more than 3, show first 3 + `+N more` with a `title` tooltip listing all.
- Keep table compact; column gets `text-xs` styling.

**CSV export**
- Add an `Orders` column right after `Item Name`, value = order numbers joined by `;` (semicolon to avoid CSV conflict).

**Print view**
- Same column appears automatically since print clones `printRef` innerHTML.

## Out of scope
- No DB changes, no new filters, no behavioral changes to fulfillment.
- Existing Order # filter input keeps working unchanged.
