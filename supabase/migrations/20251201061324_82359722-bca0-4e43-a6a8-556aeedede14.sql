-- Update the function to generate TLC-RAW-00xxx format for raw materials
CREATE OR REPLACE FUNCTION public.get_next_raw_material_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  latest_code TEXT;
  latest_number INTEGER;
  next_number INTEGER;
  next_code TEXT;
BEGIN
  -- Get the latest raw material code matching TLC-RAW-00XXX pattern (5 digits)
  SELECT sku INTO latest_code
  FROM raw_materials
  WHERE sku SIMILAR TO 'TLC-RAW-[0-9]{5}'
  ORDER BY sku DESC
  LIMIT 1;
  
  -- If no existing code found, start with 00001
  IF latest_code IS NULL THEN
    next_code := 'TLC-RAW-00001';
  ELSE
    -- Extract the numeric part (last 5 digits)
    latest_number := CAST(SUBSTRING(latest_code FROM 9 FOR 5) AS INTEGER);
    next_number := latest_number + 1;
    
    -- Format the next code with zero-padding (5 digits)
    next_code := 'TLC-RAW-' || LPAD(next_number::TEXT, 5, '0');
  END IF;
  
  RETURN next_code;
END;
$function$;