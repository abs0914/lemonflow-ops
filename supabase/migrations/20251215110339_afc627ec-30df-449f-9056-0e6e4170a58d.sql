-- Reset admin password using bcrypt hashing
UPDATE auth.users 
SET encrypted_password = crypt('P@$$word2025!', gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@lemonco.com';