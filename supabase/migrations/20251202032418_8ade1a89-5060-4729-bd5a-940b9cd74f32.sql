-- Add support for raw materials in purchase order lines
-- Make component_id nullable since we'll now support both components and raw materials
ALTER TABLE purchase_order_lines 
ALTER COLUMN component_id DROP NOT NULL;

-- Add raw_material_id column
ALTER TABLE purchase_order_lines 
ADD COLUMN raw_material_id UUID REFERENCES raw_materials(id);

-- Add item_type column to track whether this line is for a component or raw material
ALTER TABLE purchase_order_lines 
ADD COLUMN item_type TEXT NOT NULL DEFAULT 'component' CHECK (item_type IN ('component', 'raw_material'));

-- Add check constraint to ensure either component_id OR raw_material_id is set (but not both)
ALTER TABLE purchase_order_lines 
ADD CONSTRAINT check_single_item_reference CHECK (
  (component_id IS NOT NULL AND raw_material_id IS NULL) OR
  (component_id IS NULL AND raw_material_id IS NOT NULL)
);