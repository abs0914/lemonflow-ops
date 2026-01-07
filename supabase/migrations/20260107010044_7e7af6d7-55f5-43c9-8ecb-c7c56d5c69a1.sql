-- Delete stock movements for raw materials
DELETE FROM stock_movements WHERE item_type = 'raw_material';

-- Delete purchase order lines that reference raw materials
DELETE FROM purchase_order_lines WHERE raw_material_id IS NOT NULL;

-- Delete all raw materials (test data)
DELETE FROM raw_materials;