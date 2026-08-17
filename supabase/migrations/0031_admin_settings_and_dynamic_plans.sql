-- Migration 0031: Add admin_settings table for dynamic plans and trial configuration

CREATE TABLE IF NOT EXISTS admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    default_trial_days INT NOT NULL DEFAULT 7,
    trial_enabled BOOLEAN NOT NULL DEFAULT true,
    default_trial_plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Ensure there is always exactly one row (singleton pattern)
INSERT INTO admin_settings (default_trial_days, trial_enabled) 
SELECT 7, true
WHERE NOT EXISTS (SELECT 1 FROM admin_settings);

-- Enable RLS
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

-- Policies for admin_settings
-- Anyone authenticated can read
DROP POLICY IF EXISTS "Anyone can read admin_settings" ON admin_settings;
CREATE POLICY "Anyone can read admin_settings" ON admin_settings
    FOR SELECT
    TO authenticated
    USING (true);

-- Only super_admin can update
DROP POLICY IF EXISTS "Super admin can update admin_settings" ON admin_settings;
CREATE POLICY "Super admin can update admin_settings" ON admin_settings
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'super_admin'
        )
    );
