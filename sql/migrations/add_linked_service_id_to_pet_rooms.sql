-- Migration to add linked_service_id to pet_rooms
BEGIN;
ALTER TABLE pet_rooms ADD COLUMN IF NOT EXISTS linked_service_id UUID REFERENCES products(id);
COMMIT;
