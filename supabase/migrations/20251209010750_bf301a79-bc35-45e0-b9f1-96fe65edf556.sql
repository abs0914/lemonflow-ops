-- Drop the existing check constraint on role
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add updated check constraint that includes Fulfillment role
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('Admin', 'CEO', 'Production', 'Warehouse', 'Store', 'Fulfillment'));