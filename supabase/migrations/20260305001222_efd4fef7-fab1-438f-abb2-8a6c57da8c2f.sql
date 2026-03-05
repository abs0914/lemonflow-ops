
-- Delete all purchase order lines first (foreign key dependency)
DELETE FROM purchase_order_lines;

-- Delete all purchase orders
DELETE FROM purchase_orders;

-- Also clean up any related stock movements referencing POs
UPDATE stock_movements SET purchase_order_id = NULL WHERE purchase_order_id IS NOT NULL;

-- Clean up sync logs for POs
DELETE FROM autocount_sync_log WHERE reference_type = 'purchase_order';
