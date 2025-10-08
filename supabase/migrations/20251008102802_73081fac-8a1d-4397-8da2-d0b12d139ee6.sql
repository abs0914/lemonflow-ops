-- Add AutoCount-related fields to components table
ALTER TABLE components
ADD COLUMN item_group text,
ADD COLUMN item_type text DEFAULT 'CONSUMABLE',
ADD COLUMN stock_control boolean DEFAULT true,
ADD COLUMN has_batch_no boolean DEFAULT false,
ADD COLUMN price numeric,
ADD COLUMN autocount_item_code text UNIQUE,
ADD COLUMN last_synced_at timestamptz;

-- Add indexes for performance
CREATE INDEX idx_components_item_group ON components(item_group);
CREATE INDEX idx_components_item_type ON components(item_type);
CREATE INDEX idx_components_autocount_code ON components(autocount_item_code);
CREATE INDEX idx_components_last_synced ON components(last_synced_at);

-- Update existing components to have default autocount_item_code matching SKU
UPDATE components 
SET autocount_item_code = sku 
WHERE autocount_item_code IS NULL;