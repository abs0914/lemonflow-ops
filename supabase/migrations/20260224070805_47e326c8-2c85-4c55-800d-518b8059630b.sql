-- Allow all authenticated users to view basic profile info (full_name) for display purposes
CREATE POLICY "Authenticated users can view all profiles"
ON public.user_profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);