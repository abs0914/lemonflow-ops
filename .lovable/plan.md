## Goal
Hard-delete every sales order currently in `processing` status, except SO-20260701-0006, 0007, 0008, 0009, 0010, and 0011.

## Steps (single migration/data operation)

1. **Release reserved stock** for each order to be deleted by calling `release_sales_order_stock(order_id)` in a loop. This decrements `components.reserved_quantity` so inventory numbers stay correct after the orders are gone.
2. **Delete `sales_order_lines`** rows for those orders.
3. **Delete `sales_orders`** rows for those orders.

Filter used everywhere:
```sql
status = 'processing'
AND order_number NOT IN (
  'SO-20260701-0006','SO-20260701-0007','SO-20260701-0008',
  'SO-20260701-0009','SO-20260701-0010','SO-20260701-0011'
)
```

## Notes / risks (please read before approving)

- **Irreversible.** Once deleted, the orders, their line items, delivery dates, proofs of payment, fee adjustments, and audit trail are gone. History cannot be reverted from the app.
- Roughly ~150+ processing orders dating back to May 22, 2026 will be removed. If you want me to narrow the range (e.g. only recent ones, or only specific stores), tell me before approving.
- These orders have **already been AutoCount-synced** when they entered `processing`. Deleting them here does NOT remove the matching Sales Orders in AutoCount — that must be done in AutoCount separately if needed.
- Any `stock_movements` rows already posted for these orders (e.g. fulfillment deductions) will remain for audit; only the SO records are removed.
