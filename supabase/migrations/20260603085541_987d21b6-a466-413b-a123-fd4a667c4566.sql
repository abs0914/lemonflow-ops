-- 1. Reverse prior incorrect backfill against TLC-RAW-00083
INSERT INTO public.stock_movements (item_id, item_type, movement_type, quantity, notes, performed_by, reference_type, reference_id, created_at)
VALUES
  ('a85025fc-9d58-484f-aa0c-b8d287dd8527', 'raw_material', 'adjustment', 140045, 'Reverse erroneous backfill: BOM corrected to use TLC-RAW-00021 (White Sugar Urc) instead.', 'c56bb45f-e77d-4e7e-b96c-cc3cb41d86df', 'stock_movement', '9439247f-b973-42ef-9e8e-cdfc85d67f8f', now()),
  ('a85025fc-9d58-484f-aa0c-b8d287dd8527', 'raw_material', 'adjustment', 71915, 'Reverse erroneous backfill: BOM corrected to use TLC-RAW-00021 (White Sugar Urc) instead.', 'c56bb45f-e77d-4e7e-b96c-cc3cb41d86df', 'stock_movement', '007463a4-f8c4-4f93-a0c3-d81a26975aa1', now()),
  ('a85025fc-9d58-484f-aa0c-b8d287dd8527', 'raw_material', 'adjustment', 151400, 'Reverse erroneous backfill: BOM corrected to use TLC-RAW-00021 (White Sugar Urc) instead.', 'c56bb45f-e77d-4e7e-b96c-cc3cb41d86df', 'stock_movement', '8ad6109b-28fc-4bff-84ae-ae4d3af3cac8', now());

-- Restore TLC-RAW-00083 stock to its original value (trigger pushed it from 0 to 363,360)
UPDATE public.raw_materials
SET stock_quantity = 130651, updated_at = now()
WHERE id = 'a85025fc-9d58-484f-aa0c-b8d287dd8527';

-- 2. Insert correct assembly_consume against TLC-RAW-00021 (White Sugar Urc), 3.154 kg/gallon
INSERT INTO public.stock_movements (item_id, item_type, movement_type, quantity, notes, performed_by, reference_type, reference_id, created_at)
VALUES
  ('da72337b-97a3-4f90-9909-b452e7ad1b98', 'raw_material', 'assembly_consume', -116.698, 'Backfill BOM consumption for WHITE SUGAR SYRUP production qty 37 gal (3.154 kg/gal).', 'c56bb45f-e77d-4e7e-b96c-cc3cb41d86df', 'stock_movement', '9439247f-b973-42ef-9e8e-cdfc85d67f8f', '2026-06-02 01:13:20.40019+00'),
  ('da72337b-97a3-4f90-9909-b452e7ad1b98', 'raw_material', 'assembly_consume', -59.926, 'Backfill BOM consumption for WHITE SUGAR SYRUP production qty 19 gal (3.154 kg/gal).', 'c56bb45f-e77d-4e7e-b96c-cc3cb41d86df', 'stock_movement', '007463a4-f8c4-4f93-a0c3-d81a26975aa1', '2026-06-02 01:41:13.856969+00'),
  ('da72337b-97a3-4f90-9909-b452e7ad1b98', 'raw_material', 'assembly_consume', -126.160, 'Backfill BOM consumption for WHITE SUGAR SYRUP production qty 40 gal (3.154 kg/gal).', 'c56bb45f-e77d-4e7e-b96c-cc3cb41d86df', 'stock_movement', '8ad6109b-28fc-4bff-84ae-ae4d3af3cac8', '2026-06-03 06:34:53.6268+00');