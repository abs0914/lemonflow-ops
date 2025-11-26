-- Create function to generate next supplier code
CREATE OR REPLACE FUNCTION public.get_next_supplier_code()
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
  -- Get the latest supplier code matching CR-TLC-XXX pattern
  SELECT supplier_code INTO latest_code
  FROM suppliers
  WHERE supplier_code SIMILAR TO 'CR-TLC-[0-9]{3}'
  ORDER BY supplier_code DESC
  LIMIT 1;
  
  -- If no existing code found, start with 001
  IF latest_code IS NULL THEN
    next_code := 'CR-TLC-001';
  ELSE
    -- Extract the numeric part (last 3 digits)
    latest_number := CAST(SUBSTRING(latest_code FROM 8 FOR 3) AS INTEGER);
    next_number := latest_number + 1;
    
    -- Format the next code with zero-padding
    next_code := 'CR-TLC-' || LPAD(next_number::TEXT, 3, '0');
  END IF;
  
  RETURN next_code;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_next_supplier_code() TO authenticated;