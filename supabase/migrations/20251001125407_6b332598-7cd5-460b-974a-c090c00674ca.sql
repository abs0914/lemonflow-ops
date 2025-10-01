-- Update user profiles to match their correct roles based on email
-- First, get the user IDs from auth.users and update their profiles

-- Update Admin user profile
UPDATE public.user_profiles
SET 
  full_name = 'Admin User',
  role = 'Admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'admin@lemonco.com'
);

-- Update Production user profile
UPDATE public.user_profiles
SET 
  full_name = 'Production Manager',
  role = 'Production'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'production@lemonco.com'
);

-- Update Warehouse user profile
UPDATE public.user_profiles
SET 
  full_name = 'Warehouse Operator',
  role = 'Warehouse'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'warehouse@lemonco.com'
);