-- Tabla para almacenar credenciales biométricas (WebAuthn)
CREATE TABLE IF NOT EXISTS biometric_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter INTEGER DEFAULT 0,
    device_name VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(user_id, credential_id)
);

-- Índice para búsqueda rápida por credential_id
CREATE INDEX IF NOT EXISTS idx_biometric_credential_id ON biometric_credentials(credential_id);

-- Índice para búsqueda por user_id
CREATE INDEX IF NOT EXISTS idx_biometric_user_id ON biometric_credentials(user_id);

-- Deshabilitar RLS para que funcione
ALTER TABLE biometric_credentials DISABLE ROW LEVEL SECURITY;
