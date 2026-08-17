-- Migration 0042: Add Produto Permissions & Ensure Policies

-- 1. Insert product permissions into sys_permissions
INSERT INTO sys_permissions (key, module, description) VALUES
('produto.criar', 'Produtos', 'Pode cadastrar um novo produto no estoque'),
('produto.editar', 'Produtos', 'Pode alterar preços, estoque e dados de produtos'),
('produto.excluir', 'Produtos', 'Pode inativar ou excluir produtos do catálogo')
ON CONFLICT (key) DO UPDATE SET
    module = EXCLUDED.module,
    description = EXCLUDED.description;

-- 2. Garantir que as políticas de financial_transactions permitam INSERT e UPDATE para donos
DROP POLICY IF EXISTS "Tenant isolation for financial_transactions" ON financial_transactions;

CREATE POLICY "Tenant isolation for financial_transactions" ON financial_transactions
    FOR ALL 
    USING (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) 
        OR is_super_admin()
    )
    WITH CHECK (
        tenant_id = (SELECT tenant_id FROM profiles WHERE id = auth.uid()) 
        OR is_super_admin()
    );
