DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT item_type, item_id, quantity, purchase_order_id FROM stock_movements WHERE movement_type = 'receipt' LOOP
    IF r.item_type = 'component' THEN
      UPDATE components
      SET stock_quantity = GREATEST(reserved_quantity, stock_quantity - r.quantity)
      WHERE id = r.item_id;
    ELSIF r.item_type = 'raw_material' THEN
      UPDATE raw_materials
      SET stock_quantity = GREATEST(reserved_quantity, stock_quantity - r.quantity)
      WHERE id = r.item_id;
    ELSIF r.item_type = 'product' THEN
      UPDATE products SET stock_quantity = GREATEST(0, stock_quantity - r.quantity) WHERE id = r.item_id;
    ELSIF r.item_type = 'finished_good' THEN
      UPDATE finished_goods SET stock_quantity = GREATEST(0, stock_quantity - r.quantity) WHERE id = r.item_id;
    END IF;
  END LOOP;

  UPDATE purchase_order_lines pol
  SET received_quantity = 0
  WHERE EXISTS (
    SELECT 1 FROM stock_movements sm
    WHERE sm.movement_type = 'receipt' AND sm.purchase_order_id = pol.purchase_order_id
  );

  UPDATE purchase_orders
  SET goods_received = false,
      received_at = NULL,
      received_by = NULL,
      status = CASE WHEN status IN ('received','partially_received') THEN 'verified' ELSE status END
  WHERE id IN (SELECT DISTINCT purchase_order_id FROM stock_movements WHERE movement_type='receipt' AND purchase_order_id IS NOT NULL);

  DELETE FROM stock_movements WHERE movement_type = 'receipt';
END $$;