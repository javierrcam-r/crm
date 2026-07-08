-- Colaboradores con edición completa de un evento (cualquier rol, asignados por supervisor)
CREATE TABLE IF NOT EXISTS event_editors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_profile_id UUID NOT NULL,
  assigned_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_event_editors_event ON event_editors(event_id);
CREATE INDEX IF NOT EXISTS idx_event_editors_user ON event_editors(user_profile_id);

ALTER TABLE event_editors DISABLE ROW LEVEL SECURITY;
