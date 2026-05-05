
ALTER TABLE public.raw_materials ADD COLUMN IF NOT EXISTS is_perishable BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS valid_movement_type;
ALTER TABLE public.stock_movements ADD CONSTRAINT valid_movement_type
  CHECK (movement_type = ANY (ARRAY['receipt'::text, 'issue'::text, 'adjustment'::text, 'assembly_consume'::text, 'assembly_produce'::text, 'shrinkage'::text]));

CREATE OR REPLACE FUNCTION public.post_shrinkage_adjustment(
  p_raw_material_id uuid,
  p_loss_quantity numeric,
  p_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_is_perishable boolean;
  v_current_qty numeric;
  v_new_qty numeric;
  v_name text;
  v_sku text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role INTO v_role FROM user_profiles WHERE id = auth.uid();
  IF v_role NOT IN ('Admin','Warehouse','Production') THEN
    RAISE EXCEPTION 'Insufficient permissions to log shrinkage';
  END IF;

  IF p_loss_quantity IS NULL OR p_loss_quantity <= 0 THEN
    RAISE EXCEPTION 'Loss quantity must be greater than zero';
  END IF;

  IF p_notes IS NULL OR length(trim(p_notes)) = 0 THEN
    RAISE EXCEPTION 'Notes / reason are required';
  END IF;

  SELECT is_perishable, stock_quantity, name, sku
    INTO v_is_perishable, v_current_qty, v_name, v_sku
  FROM raw_materials WHERE id = p_raw_material_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw material not found';
  END IF;

  IF NOT v_is_perishable THEN
    RAISE EXCEPTION 'Shrinkage can only be logged on perishable raw materials';
  END IF;

  v_new_qty := GREATEST(0, v_current_qty - p_loss_quantity);

  INSERT INTO stock_movements (
    item_id, item_type, movement_type, quantity,
    notes, performed_by, autocount_synced
  ) VALUES (
    p_raw_material_id, 'raw_material', 'shrinkage', -p_loss_quantity,
    p_notes, auth.uid(), false
  );

  UPDATE raw_materials
    SET stock_quantity = v_new_qty, updated_at = now()
    WHERE id = p_raw_material_id;

  RETURN jsonb_build_object(
    'success', true,
    'previous_quantity', v_current_qty,
    'new_quantity', v_new_qty,
    'loss', p_loss_quantity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_shrinkage_adjustment(uuid, numeric, text) TO authenticated;
