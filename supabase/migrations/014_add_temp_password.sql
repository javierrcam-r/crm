-- =====================================================
-- AGREGAR CAMPO DE CONTRASEÑA TEMPORAL
-- =====================================================
-- Este campo guarda la contraseña temporal asignada al crear el usuario
-- para que el admin pueda comunicarla al usuario.
-- El usuario debe cambiarla después de iniciar sesión.
-- =====================================================

-- Agregar columna password_temp a users_profile
ALTER TABLE users_profile
ADD COLUMN IF NOT EXISTS password_temp VARCHAR(100);

-- Comentario para el campo
COMMENT ON COLUMN users_profile.password_temp IS 'Contraseña temporal asignada al crear el usuario. Debe ser cambiada por el usuario.';

-- Agregar columna para saber si debe cambiar contraseña
ALTER TABLE users_profile
ADD COLUMN IF NOT EXISTS debe_cambiar_password BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN users_profile.debe_cambiar_password IS 'Indica si el usuario debe cambiar su contraseña al iniciar sesión.';
