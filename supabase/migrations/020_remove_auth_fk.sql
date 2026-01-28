-- Migración para eliminar las restricciones de clave foránea hacia auth.users
-- Ya que ahora usamos autenticación directa desde la tabla users_profile

-- Eliminar FK de users_profile hacia auth.users
ALTER TABLE users_profile 
DROP CONSTRAINT IF EXISTS users_profile_user_id_fkey;

-- Eliminar FK de customers hacia auth.users
ALTER TABLE customers 
DROP CONSTRAINT IF EXISTS customers_user_id_fkey;

-- Eliminar FK de visits hacia auth.users
ALTER TABLE visits 
DROP CONSTRAINT IF EXISTS visits_user_id_fkey;

-- Eliminar FK de products hacia auth.users
ALTER TABLE products 
DROP CONSTRAINT IF EXISTS products_user_id_fkey;

-- Eliminar FK de orders hacia auth.users
ALTER TABLE orders 
DROP CONSTRAINT IF EXISTS orders_user_id_fkey;

-- Eliminar FK de order_items hacia auth.users
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS order_items_user_id_fkey;

-- Hacer user_id opcional en users_profile (puede ser nulo ya que no usamos auth.users)
ALTER TABLE users_profile 
ALTER COLUMN user_id DROP NOT NULL;

-- Agregar FK de las tablas de datos hacia users_profile.id en lugar de auth.users
-- (Solo si no existen ya)

-- Nota: Las tablas de datos ahora referenciarán al id de users_profile
-- No agregamos nuevas FK para mantener flexibilidad
