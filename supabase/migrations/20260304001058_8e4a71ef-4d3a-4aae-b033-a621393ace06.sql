
-- Add Fulfillment UPDATE access to raw_materials
CREATE POLICY "Fulfillment can update raw materials"
ON public.raw_materials
FOR UPDATE
USING (is_fulfillment(auth.uid()));
