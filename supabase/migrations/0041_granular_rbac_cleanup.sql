-- Migration 0041: Granular RBAC Cleanup & Financial Transactions Expansion

-- 1. Expansão da tabela financial_transactions
ALTER TABLE financial_transactions 
ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES professionals(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Dinheiro',
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT now();

-- 2. Limpeza e Consolidação da Tabela sys_permissions
-- Deleta permissões obsoletas/desnecessárias conforme instrução do usuário
DELETE FROM sys_permissions WHERE key IN (
    'clientes.criar',
    'clientes.editar',
    'clientes.ver_historico',
    'configuracoes.editar_perfil',
    'configuracoes.editar_horarios_loja',
    'configuracoes.gerenciar_pagamentos',
    'configuracoes.stripe_connect',
    'assinatura.gerenciar',
    'suporte.visualizar',
    'suporte.abrir_chamado',
    'catalogo.ajustar_estoque'
);

-- Insere/Atualiza apenas as permissões oficiais vigentes
INSERT INTO sys_permissions (key, module, description) VALUES
-- Agenda
('agenda.visualizar_todos', 'Agenda', 'Pode ver a agenda de todos os profissionais do salão'),
('agenda.visualizar_minha', 'Agenda', 'Pode ver apenas a própria agenda / primeiro profissional'),
('agenda.criar', 'Agenda', 'Pode criar um novo agendamento/encaixe manual'),
('agenda.editar', 'Agenda', 'Pode reagendar, alterar serviço/profissional de um agendamento'),
('agenda.cancelar', 'Agenda', 'Pode cancelar um agendamento'),
('agenda.mudar_status', 'Agenda', 'Pode marcar agendamento como Concluído, Confirmado ou Ausência/No Show'),
('agenda.bloquear_horario', 'Agenda', 'Pode adicionar bloqueios na agenda para pausa/almoço/folga'),

-- Equipe
('equipe.visualizar', 'Equipe', 'Pode ver a lista de profissionais'),
('equipe.criar', 'Equipe', 'Pode convidar ou cadastrar um novo profissional'),
('equipe.editar_perfil', 'Equipe', 'Pode alterar nome, foto e cargo de um profissional'),
('equipe.editar_horarios', 'Equipe', 'Pode alterar o horário de trabalho de um profissional na aba Jornada'),
('equipe.inativar', 'Equipe', 'Pode inativar/desligar um profissional'),
('equipe.ver_comissoes', 'Equipe', 'Pode visualizar as comissões geradas pela equipe'),

-- Catálogo
('catalogo.visualizar', 'Catálogo', 'Pode ver a lista de serviços e produtos disponíveis'),
('catalogo.criar', 'Catálogo', 'Pode adicionar novos serviços ou produtos'),
('catalogo.editar', 'Catálogo', 'Pode alterar preços, duração, descrição ou dados de serviços e produtos'),
('catalogo.excluir', 'Catálogo', 'Pode inativar ou excluir serviços e produtos'),

-- Clientes
('clientes.visualizar', 'Clientes', 'Pode ver a lista completa da base de clientes'),
('clientes.exportar', 'Clientes', 'Pode baixar a lista de clientes em CSV/Excel'),

-- Financeiro
('financeiro.visualizar_caixa_geral', 'Financeiro', 'Pode ver o caixa de todos os profissionais da barbearia'),
('financeiro.visualizar_meu_caixa', 'Financeiro', 'Pode ver apenas as transações vinculadas ao próprio usuário'),
('financeiro.criar_lancamento', 'Financeiro', 'Pode registrar uma receita ou despesa manual'),
('financeiro.editar_lancamento', 'Financeiro', 'Pode alterar dados de um lançamento existente'),
('financeiro.excluir_lancamento', 'Financeiro', 'Pode excluir/estornar um lançamento'),
('financeiro.exportar', 'Financeiro', 'Pode exportar relatórios financeiros'),

-- Configurações
('configuracoes.editar_layout', 'Configurações', 'Pode alterar as cores, logo e banner da página pública')
ON CONFLICT (key) DO UPDATE SET
    module = EXCLUDED.module,
    description = EXCLUDED.description;

-- 3. Atualizar Função has_tenant_permission para respeitar array vazio como false
CREATE OR REPLACE FUNCTION has_tenant_permission(p_tenant_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_permissions JSONB;
BEGIN
    -- Obter as permissões do contrato ativo
    SELECT sc.permissions INTO v_permissions
    FROM subscription_contracts sc
    JOIN subscriptions s ON s.id = sc.subscription_id
    WHERE s.tenant_id = p_tenant_id AND s.status IN ('active', 'trialing', 'trial')
    LIMIT 1;

    -- Se não achou contrato, pegar do plano gratuito/default
    IF NOT FOUND OR v_permissions IS NULL THEN
        SELECT permissions INTO v_permissions FROM plans WHERE is_default = true LIMIT 1;
    END IF;

    -- Se for nulo ou array vazio, retorna false estrito (o plano não tem essa permissão)
    IF v_permissions IS NULL THEN RETURN FALSE; END IF;
    IF jsonb_typeof(v_permissions) = 'array' AND jsonb_array_length(v_permissions) = 0 THEN RETURN FALSE; END IF;

    -- Se tem '*', permite tudo
    IF v_permissions @> to_jsonb('*'::text) THEN RETURN TRUE; END IF;

    -- Verificar se o array JSONB contém a permissão solicitada
    RETURN v_permissions @> to_jsonb(p_permission_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
