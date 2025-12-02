-- Drop the existing role check constraint
ALTER TABLE public.user_profiles DROP CONSTRAINT user_profiles_role_check;

-- Add updated constraint that includes Store role
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role = ANY (ARRAY['Admin'::text, 'CEO'::text, 'Production'::text, 'Warehouse'::text, 'Store'::text]));