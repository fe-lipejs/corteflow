const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres',
});

const sql = `
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('demo-portals', 'demo-portals', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for demo-portals
DROP POLICY IF EXISTS "Public read demo-portals" ON storage.objects;
DROP POLICY IF EXISTS "Super admin upload demo-portals" ON storage.objects;
DROP POLICY IF EXISTS "Super admin update demo-portals" ON storage.objects;
DROP POLICY IF EXISTS "Super admin delete demo-portals" ON storage.objects;

CREATE POLICY "Public read demo-portals"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'demo-portals');

CREATE POLICY "Super admin upload demo-portals"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'demo-portals');

CREATE POLICY "Super admin update demo-portals"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'demo-portals');

CREATE POLICY "Super admin delete demo-portals"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'demo-portals');
`;

async function main() {
  await client.connect();
  await client.query(sql);
  console.log('demo-portals bucket created & configured!');
  await client.end();
}

main().catch(console.error);
