
-- Add recommended_cost_price column to components and raw_materials
ALTER TABLE components ADD COLUMN recommended_cost_price numeric DEFAULT NULL;
ALTER TABLE raw_materials ADD COLUMN recommended_cost_price numeric DEFAULT NULL;

-- Backfill components
UPDATE components SET recommended_cost_price = GREATEST(
  COALESCE(cost_per_unit, 0),
  COALESCE((SELECT MAX(unit_cost) FROM stock_movements WHERE item_id = components.id AND item_type = 'component'), 0)
);

-- Backfill raw_materials
UPDATE raw_materials SET recommended_cost_price = GREATEST(
  COALESCE(cost_per_unit, 0),
  COALESCE((SELECT MAX(unit_cost) FROM stock_movements WHERE item_id = raw_materials.id AND item_type = 'raw_material'), 0)
);

-- Create trigger function
CREATE OR REPLACE FUNCTION public.update_recommended_cost_price()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.unit_cost IS NOT NULL THEN
    IF NEW.item_type = 'component' THEN
      UPDATE components
      SET recommended_cost_price = NEW.unit_cost
      WHERE id = NEW.item_id
        AND (recommended_cost_price IS NULL OR recommended_cost_price < NEW.unit_cost);
    ELSIF NEW.item_type = 'raw_material' THEN
      UPDATE raw_materials
      SET recommended_cost_price = NEW.unit_cost
      WHERE id = NEW.item_id
        AND (recommended_cost_price IS NULL OR recommended_cost_price < NEW.unit_cost);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on stock_movements
CREATE TRIGGER trg_update_recommended_cost_price
  AFTER INSERT ON stock_movements
  FOR EACH ROW
  EXECUTE FUNCTION update_recommended_cost_price();
