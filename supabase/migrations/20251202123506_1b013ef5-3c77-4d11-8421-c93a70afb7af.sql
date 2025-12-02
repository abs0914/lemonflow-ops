-- Drop the existing foreign key that references auth.users
ALTER TABLE public.user_store_assignments 
DROP CONSTRAINT IF EXISTS user_store_assignments_user_id_fkey;

-- Add new foreign key referencing user_profiles
ALTER TABLE public.user_store_assignments 
ADD CONSTRAINT user_store_assignments_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;