-- Migration 0020: Stripe Sync, Inadimplência e Bloqueios Automáticos

-- 1. Novas colunas para assinaturas
ALTER TABLE subscriptions 
ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS latest_invoice_status TEXT;

-- 2. Tabela de logs de eventos do Stripe para auditoria e idempotência
CREATE TABLE IF NOT EXISTS stripe_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    error TEXT
);

-- RLS para stripe_events (Apenas super_admin pode ler)
ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view stripe_events" ON stripe_events;
CREATE POLICY "Super admins can view stripe_events" ON stripe_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 3. Função para suspender contas com carência vencida
CREATE OR REPLACE FUNCTION suspend_overdue_tenants()
RETURNS void AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT s.tenant_id, s.grace_period_ends_at 
        FROM subscriptions s
        JOIN tenants t ON s.tenant_id = t.id
        WHERE s.grace_period_ends_at IS NOT NULL 
          AND s.grace_period_ends_at < now()
          AND t.status != 'suspended'
          AND t.status != 'canceled'
    LOOP
        -- Suspender o tenant
        UPDATE tenants 
        SET status = 'suspended' 
        WHERE id = r.tenant_id;

        -- Atualizar motivo
        UPDATE subscriptions 
        SET suspension_reason = 'Suspenso automaticamente por falta de pagamento (prazo de 5 dias expirado).' 
        WHERE tenant_id = r.tenant_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Função segura para o admin deletar um tenant apenas se não tiver assinatura ativa/pendente
CREATE OR REPLACE FUNCTION delete_tenant_safely(p_tenant_id UUID)
RETURNS void AS $$
DECLARE
    sub_status TEXT;
BEGIN
    -- Checa se o tenant existe
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = p_tenant_id) THEN
        RAISE EXCEPTION 'Empresa não encontrada.';
    END IF;

    -- Pega o status da assinatura
    SELECT status INTO sub_status
    FROM subscriptions
    WHERE tenant_id = p_tenant_id
    ORDER BY current_period_end DESC NULLS LAST
    LIMIT 1;

    -- Só permite deletar se a assinatura for nula, canceled, incomplete_expired ou trial (sem cobrança iniciada)
    IF sub_status IN ('active', 'past_due', 'unpaid') THEN
        RAISE EXCEPTION 'Não é possível apagar esta empresa pois ela possui uma assinatura % no Stripe. Cancele a assinatura primeiro.', sub_status;
    END IF;

    -- Se passou na validação, apaga a empresa. 
    -- Como as FKs têm ON DELETE CASCADE, tudo associado será apagado (customers, bookings, etc).
    DELETE FROM tenants WHERE id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
