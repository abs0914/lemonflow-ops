
CREATE OR REPLACE FUNCTION public.prevent_duplicate_stock_movements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists boolean;
BEGIN
  -- Only guard manual adjustments; never block automated movements
  -- (assembly_consume/produce, sales fulfilment, GRN, etc.)
  IF NEW.movement_type NOT IN ('receipt', 'issue', 'adjustment', 'shrinkage') THEN
    RETURN NEW;
  END IF;

  IF NEW.performed_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM stock_movements
    WHERE item_id = NEW.item_id
      AND item_type = NEW.item_type
      AND movement_type = NEW.movement_type
      AND quantity = NEW.quantity
      AND performed_by = NEW.performed_by
      AND COALESCE(notes, '') = COALESCE(NEW.notes, '')
      AND created_at > (now() - interval '30 seconds')
  ) INTO v_exists;

  IF v_exists THEN
    RAISE EXCEPTION 'DUPLICATE_STOCK_MOVEMENT: An identical stock movement for this item was just posted. Please wait a moment before retrying.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_stock_movements ON public.stock_movements;
CREATE TRIGGER trg_prevent_duplicate_stock_movements
BEFORE INSERT ON public.stock_movements
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_stock_movements();
