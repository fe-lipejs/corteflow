const url = 'https://paefckmkawocjxzuoclq.supabase.co';
const serviceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhZWZja21rYXdvY2p4enVvY2xxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDk4MzkwNSwiZXhwIjoyMTAwNTU5OTA1fQ.LoKvxQr-POJwRHCKKH5ZiBLAkliWflfNKlD-v4WrlFQ';

async function run() {
  const query = `
CREATE OR REPLACE FUNCTION clear_force_password_change(p_professional_id UUID)
RETURNS void AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    UPDATE professionals
    SET force_password_change = false
    WHERE id = p_professional_id
      AND auth_user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
  `;
  const res = await fetch(url + '/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + serviceKey, 'apikey': serviceKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: query })
  });
  console.log('RPC creation status:', res.status);
  
  if (res.status === 404) {
      console.log('exec_sql not available, fallback to REST direct update for Felipe...');
      // Fallback: manually update the user right now so he can pass
      const profRes = await fetch(url + '/rest/v1/professionals?auth_user_id=eq.f694aa7f-2bd3-4281-b762-e4c925b11c4f', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + serviceKey, 'apikey': serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_password_change: false })
      });
      console.log('Direct update status:', profRes.status);
  } else {
      console.log(await res.text());
      
      // Also apply it directly to Felipe right now so he's unblocked without doing anything
      await fetch(url + '/rest/v1/professionals?auth_user_id=eq.f694aa7f-2bd3-4281-b762-e4c925b11c4f', {
        method: 'PATCH',
        headers: { 'Authorization': 'Bearer ' + serviceKey, 'apikey': serviceKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({ force_password_change: false })
      });
  }
}
run();
