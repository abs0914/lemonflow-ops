-- Clear all component-related data before fresh sync from AutoCount
DELETE FROM stock_movements WHERE item_type = 'component';
DELETE FROM purchase_order_lines WHERE component_id IS NOT NULL;
DELETE FROM components;