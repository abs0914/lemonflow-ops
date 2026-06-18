CREATE POLICY "Warehouse and Production can update processing orders"
ON public.sales_orders FOR UPDATE
TO authenticated
USING (
  (status = ANY (ARRAY['processing'::text, 'fulfilled'::text]))
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role IN ('Warehouse','Production')
  )
)
WITH CHECK (
  (status = ANY (ARRAY['processing'::text, 'fulfilled'::text, 'completed'::text, 'issues'::text]))
  AND EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role IN ('Warehouse','Production')
  )
);