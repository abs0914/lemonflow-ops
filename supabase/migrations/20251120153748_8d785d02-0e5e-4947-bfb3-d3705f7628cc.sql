-- Add component_id to products table to link products to inventory components
ALTER TABLE products ADD COLUMN component_id uuid REFERENCES components(id) ON DELETE SET NULL;

-- Add unique constraint to ensure one product per component
ALTER TABLE products ADD CONSTRAINT products_component_id_key UNIQUE (component_id);

-- Create index for better query performance
CREATE INDEX idx_products_component_id ON products(component_id);

COMMENT ON COLUMN products.component_id IS 'Links the product to its corresponding inventory component for stock tracking';