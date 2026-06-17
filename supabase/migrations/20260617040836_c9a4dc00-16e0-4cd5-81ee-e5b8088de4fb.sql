ALTER TABLE public.user_profiles DISABLE TRIGGER USER;
UPDATE public.user_profiles SET role = 'Fulfillment', updated_at = now() WHERE id = '7304155e-0823-432c-8fec-88837e9be257';
ALTER TABLE public.user_profiles ENABLE TRIGGER USER;
DELETE FROM public.user_roles WHERE user_id = '7304155e-0823-432c-8fec-88837e9be257';
INSERT INTO public.user_roles (user_id, role) VALUES ('7304155e-0823-432c-8fec-88837e9be257', 'Fulfillment');