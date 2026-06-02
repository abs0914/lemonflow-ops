UPDATE public.components SET reserved_quantity = 0 WHERE reserved_quantity <> 0;
UPDATE public.raw_materials SET reserved_quantity = 0 WHERE reserved_quantity <> 0;
UPDATE public.sales_orders SET stock_reserved = false WHERE stock_reserved = true;
UPDATE public.assembly_orders SET stock_reserved = false WHERE stock_reserved = true;