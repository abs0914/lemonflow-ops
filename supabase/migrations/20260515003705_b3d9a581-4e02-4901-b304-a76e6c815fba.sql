
-- Backfill stock for historical production logs
UPDATE components SET stock_quantity = stock_quantity + 218, updated_at = now()
  WHERE id = '266c53c0-8852-4b0e-b136-8b05f7ea12c9';

UPDATE components SET stock_quantity = stock_quantity + 56, updated_at = now()
  WHERE id = '1aa562ca-c298-44cd-84bd-1dbff1841645';

-- Repoint historical assembly_produce movements from product id to component id
UPDATE stock_movements SET item_id = '266c53c0-8852-4b0e-b136-8b05f7ea12c9'
  WHERE movement_type = 'assembly_produce'
    AND item_type = 'component'
    AND item_id = 'f09b84df-1737-4883-913b-8c155ecd9547';

UPDATE stock_movements SET item_id = '1aa562ca-c298-44cd-84bd-1dbff1841645'
  WHERE movement_type = 'assembly_produce'
    AND item_type = 'component'
    AND item_id = 'd264aa9e-1e27-4146-9a47-7d1f54417d84';
