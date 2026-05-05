UPDATE public.components SET reserved_quantity = 0 WHERE reserved_quantity <> 0;
UPDATE public.raw_materials SET reserved_quantity = 0 WHERE reserved_quantity <> 0;