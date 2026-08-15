-- Migration: 0027_add_completed_guides.sql
-- Add completed_guides JSONB array to profiles to persist seen/dismissed contextual guides

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS completed_guides JSONB NOT NULL DEFAULT '[]'::jsonb;
