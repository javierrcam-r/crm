CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users_profile(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'sistema' CHECK (type IN ('actividad', 'evento', 'sistema')),
  reference_id UUID,
  reference_url TEXT,
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES users_profile(id),
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_app_notifications_user_id ON app_notifications(user_id);
CREATE INDEX idx_app_notifications_read ON app_notifications(user_id, read);
CREATE INDEX idx_app_notifications_created_at ON app_notifications(created_at DESC);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON app_notifications FOR SELECT
  USING (true);
  
CREATE POLICY "Authenticated users can insert notifications"
  ON app_notifications FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can update their own notifications"
  ON app_notifications FOR UPDATE
  USING (true);
