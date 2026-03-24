-- Add seat number to event participants (unique per event)
ALTER TABLE event_participants ADD COLUMN IF NOT EXISTS numero_asiento VARCHAR(50);

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_participants_seat 
    ON event_participants(event_id, numero_asiento) 
    WHERE numero_asiento IS NOT NULL AND numero_asiento != '';
