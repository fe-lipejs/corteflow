const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

const sql = `
CREATE TABLE IF NOT EXISTS demo_portals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  business_name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#D4AF37',
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  professionals JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_whatsapp TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for slug lookups
CREATE INDEX IF NOT EXISTS idx_demo_portals_slug ON demo_portals (slug);

-- Enable RLS
ALTER TABLE demo_portals ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public read active unexpired demo portals" ON demo_portals;
DROP POLICY IF EXISTS "Super admin manage demo portals" ON demo_portals;

-- Public read policy: only active and unexpired
CREATE POLICY "Public read active unexpired demo portals"
ON demo_portals
FOR SELECT
TO anon, authenticated
USING (active = true AND expires_at > now());

-- Super admin manage policy: super_admin can do EVERYTHING
CREATE POLICY "Super admin manage demo portals"
ON demo_portals
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'super_admin' OR profiles.is_super_admin = true)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND (profiles.role = 'super_admin' OR profiles.is_super_admin = true)
  )
);

-- RPC for incrementing views safely without needing UPDATE permissions on demo_portals
CREATE OR REPLACE FUNCTION increment_demo_portal_views(p_slug TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE demo_portals
  SET views = views + 1
  WHERE slug = p_slug AND active = true AND expires_at > now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_demo_portal_views(TEXT) TO anon, authenticated;
`;

async function main() {
  try {
    await client.connect();
    console.log('Connected to Postgres');
    await client.query(sql);
    console.log('Table demo_portals and policies created successfully!');
  } catch (err) {
    console.error('Error creating demo_portals:', err);
  } finally {
    await client.end();
  }
}

main();
