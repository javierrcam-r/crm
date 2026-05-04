-- =============================================================
-- 042: Rol "Vendedor + Técnico" y tipo de actividad "tecnico"
-- =============================================================
-- Se agrega un rol híbrido `vendedor_tecnico` (vendedor que también
-- realiza tareas técnicas) y un nuevo `tipo` de actividad `tecnico`
-- para que los usuarios puedan categorizar específicamente las
-- actividades técnicas que aparecen al pulsar el botón "Ver Técnico"
-- en el calendario.

-- 1) Permitir el nuevo rol en users_profile
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_rol_check;

ALTER TABLE users_profile ADD CONSTRAINT users_profile_rol_check
    CHECK (rol IN (
        'admin',
        'vendedor',
        'supervisor',
        'supervisor_nivel1',
        'supervisor_vendedor',
        'vendedor_tecnico',
        'marketing',
        'tecnico',
        'event_assistant'
    ));

-- 2) Permitir el nuevo tipo `tecnico` en activities
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_tipo_check;

ALTER TABLE activities ADD CONSTRAINT activities_tipo_check
    CHECK (tipo IN (
        'reunion',
        'tarea',
        'seguimiento',
        'capacitacion',
        'tecnico',
        'otro'
    ));

-- 3) Configuración de sidebar por defecto para el nuevo rol
-- (replica las entradas visibles del rol `vendedor` para que el
-- nuevo rol arranque con un menú razonable; admin podrá ajustarlo
-- desde la pantalla de configuración de menús)
INSERT INTO sidebar_config (menu_key, menu_label, rol, visible)
SELECT menu_key, menu_label, 'vendedor_tecnico', visible
FROM sidebar_config
WHERE rol = 'vendedor'
ON CONFLICT (menu_key, rol) DO NOTHING;
