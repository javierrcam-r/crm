-- =====================================================
-- Recomendaciones inteligentes de agenda
-- =====================================================

CREATE TABLE IF NOT EXISTS agenda_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  generation_id UUID NOT NULL DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  created_visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,

  recommended_date DATE NOT NULL,
  recommended_time TIME NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'generated'
    CHECK (status IN ('generated', 'accepted', 'rejected', 'created', 'completed', 'cancelled', 'no_show', 'reprogrammed')),

  score_total DECIMAL(10, 2) NOT NULL DEFAULT 0,
  score_breakdown JSONB NOT NULL DEFAULT '{}'::jsonb,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  feedback_reason TEXT,

  responded_at TIMESTAMPTZ,
  outcome_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agenda_recommendations_user_created
  ON agenda_recommendations(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agenda_recommendations_user_customer
  ON agenda_recommendations(user_id, customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agenda_recommendations_status
  ON agenda_recommendations(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agenda_recommendations_date
  ON agenda_recommendations(user_id, recommended_date);

CREATE INDEX IF NOT EXISTS idx_agenda_recommendations_visit
  ON agenda_recommendations(created_visit_id)
  WHERE created_visit_id IS NOT NULL;

CREATE OR REPLACE FUNCTION update_agenda_recommendations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_agenda_recommendations_updated_at ON agenda_recommendations;
CREATE TRIGGER trigger_update_agenda_recommendations_updated_at
  BEFORE UPDATE ON agenda_recommendations
  FOR EACH ROW
  EXECUTE FUNCTION update_agenda_recommendations_updated_at();

ALTER TABLE agenda_recommendations DISABLE ROW LEVEL SECURITY;

COMMENT ON TABLE agenda_recommendations IS 'Historial de recomendaciones de agenda y feedback para mejorar el scoring.';
COMMENT ON COLUMN agenda_recommendations.score_breakdown IS 'Componentes del puntaje: urgencia, territorio, feedback, negocio, carga, etc.';
COMMENT ON COLUMN agenda_recommendations.features IS 'Senales usadas para generar la recomendacion en ese momento.';
