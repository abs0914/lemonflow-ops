

## Allow Fulfillment to Update Stores

### Change

Add an RLS `UPDATE` policy on `public.stores` for the Fulfillment role:

```sql
CREATE POLICY "Fulfillment can update stores"
ON public.stores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'Fulfillment'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'Fulfillment'
  )
);
```

This is a single migration. No frontend changes needed since the StoreDialog already supports editing.

