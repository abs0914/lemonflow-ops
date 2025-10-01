-- Add foreign key constraints to bom_items table
ALTER TABLE public.bom_items
  DROP CONSTRAINT IF EXISTS bom_items_product_id_fkey,
  DROP CONSTRAINT IF EXISTS bom_items_component_id_fkey;

ALTER TABLE public.bom_items
  ADD CONSTRAINT bom_items_product_id_fkey 
    FOREIGN KEY (product_id) 
    REFERENCES public.products(id) 
    ON DELETE CASCADE,
  ADD CONSTRAINT bom_items_component_id_fkey 
    FOREIGN KEY (component_id) 
    REFERENCES public.components(id) 
    ON DELETE CASCADE;