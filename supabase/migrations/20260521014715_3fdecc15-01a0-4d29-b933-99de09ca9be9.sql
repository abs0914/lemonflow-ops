-- Allow BOMs whose parent is a Raw Material (e.g., recipes for purees)
ALTER TABLE public.bom_items ADD COLUMN IF NOT EXISTS parent_raw_material_id uuid;

ALTER TABLE public.bom_items ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.bom_items DROP CONSTRAINT IF EXISTS bom_items_parent_raw_material_id_fkey;
ALTER TABLE public.bom_items ADD CONSTRAINT bom_items_parent_raw_material_id_fkey
  FOREIGN KEY (parent_raw_material_id) REFERENCES public.raw_materials(id) ON DELETE CASCADE;

ALTER TABLE public.bom_items DROP CONSTRAINT IF EXISTS bom_items_parent_xor;
ALTER TABLE public.bom_items ADD CONSTRAINT bom_items_parent_xor
  CHECK ((product_id IS NOT NULL)::int + (parent_raw_material_id IS NOT NULL)::int = 1);

CREATE INDEX IF NOT EXISTS idx_bom_items_parent_raw_material_id
  ON public.bom_items(parent_raw_material_id);