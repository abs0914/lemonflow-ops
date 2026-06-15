CREATE POLICY "Finance Admin Accounting can upload payment proofs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND (is_admin(auth.uid()) OR is_finance(auth.uid()) OR is_accounting(auth.uid()))
);