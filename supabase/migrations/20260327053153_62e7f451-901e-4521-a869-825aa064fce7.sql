-- Delete all sales order lines first (child records)
DELETE FROM sales_order_lines;

-- Delete all sales orders
DELETE FROM sales_orders;