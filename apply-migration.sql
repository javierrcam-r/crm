-- =====================================================
-- SOLUCIÓN: El trigger recalculate_order_totals estaba
-- sobrescribiendo el campo observacion_general
-- =====================================================

-- Reemplazar la función para que solo actualice los totales
CREATE OR REPLACE FUNCTION recalculate_order_totals()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE orders
    SET 
        subtotal = COALESCE((
            SELECT SUM(qty * unit_price)
            FROM order_items
            WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        ), 0),
        total_bonificado = COALESCE((
            SELECT SUM(CASE WHEN bonificado THEN qty * unit_price ELSE 0 END)
            FROM order_items
            WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        ), 0),
        total = COALESCE((
            SELECT SUM(line_total)
            FROM order_items
            WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
        ), 0),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.order_id, OLD.order_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
