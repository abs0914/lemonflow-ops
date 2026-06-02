-- Delete all pending receipt POs (verified or partially_received, not yet fully received)
DO $$
DECLARE
  v_po_ids uuid[];
BEGIN
  SELECT array_agg(id) INTO v_po_ids
  FROM purchase_orders
  WHERE status IN ('verified', 'partially_received')
    AND COALESCE(goods_received, false) = false;

  IF v_po_ids IS NULL THEN
    RAISE NOTICE 'No pending POs to delete';
    RETURN;
  END IF;

  DELETE FROM purchase_order_lines WHERE purchase_order_id = ANY(v_po_ids);
  DELETE FROM autocount_sync_log WHERE reference_type = 'purchase_order' AND reference_id = ANY(v_po_ids);
  DELETE FROM purchase_orders WHERE id = ANY(v_po_ids);

  RAISE NOTICE 'Deleted % pending POs', array_length(v_po_ids, 1);
END $$;