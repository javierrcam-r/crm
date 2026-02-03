-- =====================================================
-- MIGRACIÓN: Eliminar API Simulación
-- =====================================================
-- Elimina la tabla de API simulaciones que ya no se usa
-- =====================================================

DROP TABLE IF EXISTS api_simulations CASCADE;
