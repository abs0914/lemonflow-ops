-- Create function to generate next item code for inventory
CREATE OR REPLACE FUNCTION public.get_next_item_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  latest_code TEXT;
  latest_number INTEGER;
  next_number INTEGER;
  next_code TEXT;
BEGIN
  -- Get the latest item code matching TLCXXXXX pattern (5 digits)
  SELECT sku INTO latest_code
  FROM components
  WHERE sku SIMILAR TO 'TLC[0-9]{5}'
  ORDER BY sku DESC
  LIMIT 1;
  
  -- If no existing code found, start with 00001
  IF latest_code IS NULL THEN
    next_code := 'TLC00001';
  ELSE
    -- Extract the numeric part (last 5 digits)
    latest_number := CAST(SUBSTRING(latest_code FROM 4 FOR 5) AS INTEGER);
    next_number := latest_number + 1;
    
    -- Format the next code with zero-padding (5 digits)
    next_code := 'TLC' || LPAD(next_number::TEXT, 5, '0');
  END IF;
  
  RETURN next_code;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_next_item_code() TO authenticated;