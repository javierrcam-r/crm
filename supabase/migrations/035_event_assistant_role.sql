-- Add event_assistant role for staff at events who scan QR codes and manage attendance
ALTER TABLE users_profile DROP CONSTRAINT IF EXISTS users_profile_rol_check;

ALTER TABLE users_profile ADD CONSTRAINT users_profile_rol_check 
    CHECK (rol IN (
        'admin', 
        'vendedor', 
        'supervisor', 
        'supervisor_nivel1',
        'supervisor_vendedor',
        'marketing', 
        'tecnico',
        'event_assistant'
    ));
