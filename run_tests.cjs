const { Client } = require('pg');
const fs = require('fs');

async function run() {
  const connectionString = "postgresql://postgres:El4ever7%23uv3@db.paefckmkawocjxzuoclq.supabase.co:5432/postgres";
  const client = new Client({ connectionString });
  await client.connect();

  console.log("--- EXECUTANDO MIGRATION ---");
  const sql = fs.readFileSync('supabase/migrations/0074_v3_trial_engine.sql', 'utf8');
  try {
    await client.query(sql);
    console.log("Migration aplicada com sucesso!");
  } catch(e) {
    console.error("Erro na migration:", e.message);
  }

  console.log("\n--- TESTE 1: Colunas em tenants ---");
  const res1 = await client.query(`
    select column_name, data_type 
    from information_schema.columns 
    where table_name = 'tenants' 
    and column_name in ('account_state', 'trial_started_at', 'trial_ends_at', 'past_due_since');
  `);
  console.table(res1.rows);

  console.log("\n--- TESTE 2: billing_events constraints ---");
  const res2 = await client.query(`
    SELECT
      conname AS constraint_name,
      contype AS constraint_type
    FROM pg_constraint
    WHERE conrelid = 'public.billing_events'::regclass;
  `);
  console.table(res2.rows);

  console.log("\n--- TESTE 3: is_account_writable existe ---");
  const res3 = await client.query(`
    select proname from pg_proc where proname = 'is_account_writable';
  `);
  console.table(res3.rows);

  console.log("\n--- TESTE 4: RLS Policies ---");
  const res4 = await client.query(`
    select tablename, policyname, qual, with_check 
    from pg_policies 
    where tablename in ('services','professionals','bookings','financial_transactions');
  `);
  res4.rows.forEach(r => {
    console.log(`Table: ${r.tablename} | Policy: ${r.policyname}`);
    console.log(`CHECK: ${r.with_check}`);
  });

  console.log("\n--- TESTE 5: Criação de Tenant (onboarding_no_card) ---");
  const tenantRes = await client.query(`
    INSERT INTO tenants (id, business_name, slug, account_state) 
    VALUES (gen_random_uuid(), 'Test V3', 'test-v3-' || floor(random()*1000), 'onboarding_no_card')
    RETURNING id, account_state;
  `);
  const tenantId = tenantRes.rows[0].id;
  console.log("Tenant criado:", tenantRes.rows[0]);

  // Testando permissões via supabase JS não dá, a gente precisa simular o RLS.
  // Para testar o RLS, precisaríamos logar com o tenant ou fazer o trigger. 
  // O prompt fala "Tentar INSERT em services com esse tenant... Cole o erro exato retornado".
  // Podemos testar setando o role e auth.uid:
  try {
    await client.query('BEGIN;');
    await client.query(`SET LOCAL role = 'authenticated';`);
    await client.query(`SELECT set_config('request.jwt.claims', '{"sub": "auth-user-id"}', true);`);
    
    // Como RLS de services depende de tenant_id, vamos inserir
    await client.query(`INSERT INTO services (tenant_id, name, price, duration_minutes) VALUES ($1, 'Corte Teste', 50, 30)`, [tenantId]);
    console.log("❌ Falhou: Inseriu serviço em onboarding_no_card (NÃO DEVERIA ACONTECER)");
  } catch(e) {
    console.log("✅ RLS bloqueou INSERT em services com sucesso!");
    console.log("Erro retornado:", e.message);
  } finally {
    await client.query('ROLLBACK;');
  }

  await client.end();
}

run();
