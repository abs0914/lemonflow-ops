-- Drop the existing check constraint on user_profiles.role
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- Add the updated check constraint that includes Finance and Fulfillment roles
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('Admin', 'CEO', 'Production', 'Warehouse', 'Store', 'Fulfillment', 'Finance'));