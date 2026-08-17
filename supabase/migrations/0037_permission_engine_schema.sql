-- Migration 0037: Permission Engine Schema (Sprint 1)

-- 1. Create System Tables (Catalog)
CREATE TABLE IF NOT EXISTS sys_permissions (
    key VARCHAR(255) PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS sys_features (
    key VARCHAR(255) PRIMARY KEY,
    module VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE IF NOT EXISTS sys_role_permissions (
    role VARCHAR(50) NOT NULL,
    permission_key VARCHAR(255) NOT NULL REFERENCES sys_permissions(key) ON DELETE CASCADE,
    PRIMARY KEY (role, permission_key)
);

-- RLS para as tabelas de catálogo
ALTER TABLE sys_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read sys_permissions" ON sys_permissions FOR SELECT USING (true);
CREATE POLICY "Public read sys_features" ON sys_features FOR SELECT USING (true);
CREATE POLICY "Public read sys_role_permissions" ON sys_role_permissions FOR SELECT USING (true);

-- Super admin pode editar
CREATE POLICY "Super admin all sys_permissions" ON sys_permissions FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Super admin all sys_features" ON sys_features FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));
CREATE POLICY "Super admin all sys_role_permissions" ON sys_role_permissions FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'super_admin'));


-- 2. Adapt Plans and Subscription Contracts (Add permissions and limits JSONB)
ALTER TABLE plans ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE plans ADD COLUMN IF NOT EXISTS limits JSONB DEFAULT '{}'::jsonb;

ALTER TABLE subscription_contracts ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE subscription_contracts ADD COLUMN IF NOT EXISTS limits JSONB DEFAULT '{}'::jsonb;


-- 3. Backfill: Mover o max_professionals para dentro de limits
DO $$
BEGIN
    -- Atualiza plans
    UPDATE plans
    SET limits = jsonb_build_object('profissionais', max_professionals)
    WHERE max_professionals IS NOT NULL;

    -- Atualiza subscription_contracts
    UPDATE subscription_contracts
    SET limits = jsonb_build_object('profissionais', max_professionals)
    WHERE max_professionals IS NOT NULL;
END $$;


-- 4. Seed Permissions and Role Bindings
-- As sementes (Seeds) garantem a configuração inicial conforme Sprint 0.

INSERT INTO sys_permissions (key, module, description) VALUES
('agenda.visualizar_todos', 'Agenda', 'Pode ver a agenda de todos os profissionais do salão'),
('agenda.visualizar_minha', 'Agenda', 'Pode ver apenas a própria agenda'),
('agenda.criar', 'Agenda', 'Pode criar um novo agendamento/encaixe manual'),
('agenda.editar', 'Agenda', 'Pode reagendar, alterar serviço/profissional de um agendamento'),
('agenda.cancelar', 'Agenda', 'Pode cancelar um agendamento'),
('agenda.mudar_status', 'Agenda', 'Pode marcar agendamento como Concluído, Confirmado ou Ausência/No Show'),
('agenda.bloquear_horario', 'Agenda', 'Pode adicionar bloqueios na agenda para pausa/almoço/folga'),

('equipe.visualizar', 'Equipe', 'Pode ver a lista de profissionais'),
('equipe.criar', 'Equipe', 'Pode convidar ou cadastrar um novo profissional'),
('equipe.editar_perfil', 'Equipe', 'Pode alterar nome, foto e cargo de um profissional'),
('equipe.editar_horarios', 'Equipe', 'Pode alterar o horário de trabalho de um profissional'),
('equipe.inativar', 'Equipe', 'Pode inativar/desligar um profissional'),
('equipe.ver_comissoes', 'Equipe', 'Pode visualizar as comissões geradas pela equipe'),

('catalogo.visualizar', 'Catálogo', 'Pode ver a lista de serviços e produtos disponíveis'),
('catalogo.criar', 'Catálogo', 'Pode adicionar novos serviços ou produtos'),
('catalogo.editar', 'Catálogo', 'Pode alterar preços, duração, descrição ou categoria'),
('catalogo.excluir', 'Catálogo', 'Pode inativar ou excluir um item do catálogo'),
('catalogo.ajustar_estoque', 'Catálogo', 'Pode adicionar ou remover itens do estoque de produtos'),

('clientes.visualizar', 'Clientes', 'Pode ver a lista completa da base de clientes'),
('clientes.criar', 'Clientes', 'Pode adicionar um cliente manualmente'),
('clientes.editar', 'Clientes', 'Pode editar telefone, nome e observações internas do cliente'),
('clientes.ver_historico', 'Clientes', 'Pode ver o histórico financeiro e agendamentos anteriores do cliente'),
('clientes.exportar', 'Clientes', 'Pode baixar a lista de clientes em CSV/Excel'),

('financeiro.visualizar_caixa_geral', 'Financeiro', 'Pode ver o faturamento total da barbearia'),
('financeiro.visualizar_meu_caixa', 'Financeiro', 'Pode ver apenas as transações vinculadas ao próprio usuário'),
('financeiro.criar_lancamento', 'Financeiro', 'Pode registrar uma receita ou despesa manual'),
('financeiro.editar_lancamento', 'Financeiro', 'Pode alterar dados de um lançamento existente'),
('financeiro.excluir_lancamento', 'Financeiro', 'Pode excluir/estornar um lançamento'),
('financeiro.exportar', 'Financeiro', 'Pode exportar relatórios financeiros'),

('configuracoes.editar_perfil', 'Configurações', 'Pode alterar o nome do salão, endereço e contatos'),
('configuracoes.editar_layout', 'Configurações', 'Pode alterar as cores, logo e banner da página pública'),
('configuracoes.editar_horarios_loja', 'Configurações', 'Pode alterar o horário de abertura e fechamento global do salão'),
('configuracoes.gerenciar_pagamentos', 'Configurações', 'Pode conectar e configurar a conta Stripe Connect'),
('assinatura.gerenciar', 'Configurações', 'Pode gerenciar a assinatura do SaaS'),

('suporte.visualizar', 'Suporte', 'Pode ver os chamados abertos pelo salão'),
('suporte.abrir_chamado', 'Suporte', 'Pode criar um novo chamado para a plataforma')
ON CONFLICT (key) DO NOTHING;


-- Seed das Roles Básicas (Tudo para Owner e Admin, restrito para Profissional)
-- Owner e Admin
INSERT INTO sys_role_permissions (role, permission_key)
SELECT 'owner'::varchar, key FROM sys_permissions
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permissions (role, permission_key)
SELECT 'admin'::varchar, key FROM sys_permissions
ON CONFLICT DO NOTHING;

-- Professional (Minha agenda e ver catálogo)
INSERT INTO sys_role_permissions (role, permission_key) VALUES
('professional', 'agenda.visualizar_minha'),
('professional', 'agenda.criar'),
('professional', 'agenda.editar'),
('professional', 'agenda.cancelar'),
('professional', 'agenda.mudar_status'),
('professional', 'agenda.bloquear_horario'),
('professional', 'catalogo.visualizar'),
('professional', 'clientes.visualizar'),
('professional', 'financeiro.visualizar_meu_caixa')
ON CONFLICT DO NOTHING;

-- Atualizar Trigger de Sincronização do Contrato para copiar Permissions e Limits também
CREATE OR REPLACE FUNCTION sync_subscription_contract()
RETURNS TRIGGER AS $$
DECLARE
    v_plan RECORD;
    v_price_amount DECIMAL(10, 2) := 0;
    v_currency VARCHAR(3) := 'BRL';
BEGIN
    SELECT * INTO v_plan FROM plans WHERE id = NEW.plan_id;
    
    IF FOUND THEN
        SELECT amount INTO v_price_amount 
        FROM plan_prices 
        WHERE plan_id = NEW.plan_id AND currency = 'BRL' 
        LIMIT 1;

        INSERT INTO subscription_contracts (
            subscription_id, plan_id, price_amount, currency, max_professionals, allow_products, features, permissions, limits
        ) VALUES (
            NEW.id, NEW.plan_id, COALESCE(v_price_amount, 0), 'BRL', v_plan.max_professionals, v_plan.allow_products, v_plan.features, COALESCE(v_plan.permissions, '[]'::jsonb), COALESCE(v_plan.limits, '{}'::jsonb)
        )
        ON CONFLICT (subscription_id) DO UPDATE SET
            plan_id = EXCLUDED.plan_id,
            price_amount = EXCLUDED.price_amount,
            max_professionals = EXCLUDED.max_professionals,
            allow_products = EXCLUDED.allow_products,
            features = EXCLUDED.features,
            permissions = EXCLUDED.permissions,
            limits = EXCLUDED.limits,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
