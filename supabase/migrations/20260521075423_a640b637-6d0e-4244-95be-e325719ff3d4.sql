ALTER TABLE public.raw_materials
ADD COLUMN IF NOT EXISTS is_bom_product boolean NOT NULL DEFAULT false;

UPDATE public.raw_materials rm
SET is_bom_product = true
WHERE EXISTS (
  SELECT 1
  FROM public.bom_items bi
  WHERE bi.parent_raw_material_id = rm.id
);