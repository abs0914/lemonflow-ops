-- Drop the problematic RLS policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;

-- Create a security definer function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles
    WHERE id = user_id
      AND role = 'Admin'
  )
$$;

-- Recreate the admin policy using the security definer function
CREATE POLICY "Admins can view all profiles"
ON public.user_profiles
FOR SELECT
TO public
USING (public.is_admin(auth.uid()));