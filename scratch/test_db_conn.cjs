const { Client } = require('pg');

const regions = [
  'sa-east-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'ca-central-1',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-north-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-south-1'
];

async function check() {
  for (const r of regions) {
    const host = `aws-0-${r}.pooler.supabase.com`;
    const client = new Client({
      host: host,
      port: 6543,
      user: 'postgres.paefckmkawocjxzuoclq',
      password: 'El4ever7#uv3',
      database: 'postgres',
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 3000
    });
    try {
      await client.connect();
      console.log(`FOUND REGION: ${r}! Connected to ${host}`);
      const res = await client.query('SELECT 1 as ok');
      console.log('Query result:', res.rows);
      await client.end();
      return r;
    } catch (e) {
      if (!e.message.includes('not found')) {
        console.log(`Region ${r}:`, e.message);
      }
    }
  }
  console.log('Finished testing regions.');
}

check();
