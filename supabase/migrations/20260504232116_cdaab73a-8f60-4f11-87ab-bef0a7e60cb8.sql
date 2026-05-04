
-- Release stock reservations for any reserved orders
DO $$
DECLARE
  v_order RECORD;
BEGIN
  FOR v_order IN SELECT id FROM sales_orders WHERE stock_reserved = true LOOP
    PERFORM release_sales_order_stock(v_order.id);
  END LOOP;
END $$;

-- Delete all sales order lines, then orders
DELETE FROM sales_order_lines;
DELETE FROM sales_orders;
