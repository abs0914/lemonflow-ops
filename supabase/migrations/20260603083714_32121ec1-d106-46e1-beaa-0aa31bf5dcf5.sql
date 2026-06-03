-- Backfill assembly_consume movements for 3 White Sugar Syrup production logs (Jun 2-3)
-- BOM: 3785 ML of TLC-RAW-00083 per gallon. Clamp final raw material stock at 0.

INSERT INTO public.stock_movements (item_id, item_type, movement_type, quantity, notes, performed_by, reference_type, reference_id, created_at)
VALUES
  ('a85025fc-9d58-484f-aa0c-b8d287dd8527', 'raw_material', 'assembly_consume', -140045, 'Backfill BOM consumption for WHITE SUGAR SYRUP production qty 37 (3785 ML/gal). Clamped stock at 0 due to insufficient inventory.', 'c56bb45f-e77d-4e7e-b96c-cc3cb41d86df', 'stock_movement', '9439247f-b973-42ef-9e8e-cdfc85d67f8f', '2026-06-02 01:13:20.40019+00'),
  ('a85025fc-9d58-484f-aa0c-b8d287dd8527', 'raw_material', 'assembly_consume', -71915, 'Backfill BOM consumption for WHITE SUGAR SYRUP production qty 19 (3785 ML/gal). Clamped stock at 0 due to insufficient inventory.', 'c56bb45f-e77d-4e7e-b96c-cc3cb41d86df', 'stock_movement', '007463a4-f8c4-4f93-a0c3-d81a26975aa1', '2026-06-02 01:41:13.856969+00'),
  ('a85025fc-9d58-484f-aa0c-b8d287dd8527', 'raw_material', 'assembly_consume', -151400, 'Backfill BOM consumption for WHITE SUGAR SYRUP production qty 40 (3785 ML/gal). Clamped stock at 0 due to insufficient inventory.', 'c56bb45f-e77d-4e7e-b96c-cc3cb41d86df', 'stock_movement', '8ad6109b-28fc-4bff-84ae-ae4d3af3cac8', '2026-06-03 06:34:53.6268+00');

-- The update_stock_quantity trigger drives stock_quantity negative; clamp at 0 per shortage decision
UPDATE public.raw_materials
SET stock_quantity = 0, updated_at = now()
WHERE id = 'a85025fc-9d58-484f-aa0c-b8d287dd8527'
  AND stock_quantity < 0;