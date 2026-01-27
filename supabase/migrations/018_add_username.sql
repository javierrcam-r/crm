-- =====================================================
-- AGREGAR CAMPO USERNAME PARA LOGIN
-- =====================================================

-- Agregar campo username
ALTER TABLE users_profile
ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;

-- Crear usernames basados en el email
UPDATE users_profile 
SET username = LOWER(SPLIT_PART(email, '@', 1))
WHERE username IS NULL;

-- Ejemplos de usernames:
-- cami.isabel22@gmail.com -> cami.isabel22
-- admin@crm.com -> admin

-- Crear username específico para Camila
UPDATE users_profile 
SET username = 'cfernandez'
WHERE email = 'cami.isabel22@gmail.com';

-- Verificar
SELECT id, username, email, nombre_completo, password FROM users_profile;
