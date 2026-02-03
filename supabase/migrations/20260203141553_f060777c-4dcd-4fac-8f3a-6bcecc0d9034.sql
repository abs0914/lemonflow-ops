-- Delete sales order lines first (foreign key constraint)
DELETE FROM sales_order_lines 
WHERE sales_order_id = (SELECT id FROM sales_orders WHERE order_number = 'SO-20260203-0002');

-- Delete the sales order
DELETE FROM sales_orders WHERE order_number = 'SO-20260203-0002';