-- Sprint 5: Tabela de Categorias
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT CHECK (type IN ('service', 'product', 'both')) NOT NULL DEFAULT 'service',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS for categories
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin has full access to categories"
ON categories FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'super_admin'
    )
);

CREATE POLICY "Tenant users can view their categories"
ON categories FOR SELECT TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles WHERE profiles.id = auth.uid()
    )
);

CREATE POLICY "Tenant owners can insert categories"
ON categories FOR INSERT TO authenticated
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
    )
);

CREATE POLICY "Tenant owners can update their categories"
ON categories FOR UPDATE TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
    )
);

CREATE POLICY "Tenant owners can delete their categories"
ON categories FOR DELETE TO authenticated
USING (
    tenant_id IN (
        SELECT tenant_id FROM profiles
        WHERE profiles.id = auth.uid() AND profiles.role = 'owner'
    )
);

-- Migração de categorias hardcoded (inserindo as categorias padrão)
DO $$ 
DECLARE
    t RECORD;
BEGIN
    FOR t IN SELECT id FROM tenants LOOP
        INSERT INTO categories (tenant_id, name, type) VALUES 
        (t.id, 'Cortes', 'service'),
        (t.id, 'Barba', 'service'),
        (t.id, 'Coloração', 'service'),
        (t.id, 'Tratamentos', 'service'),
        (t.id, 'Combos', 'service'),
        (t.id, 'Outros', 'service'),
        (t.id, 'Produtos', 'product'),
        (t.id, 'Bebidas', 'product')
        ON CONFLICT DO NOTHING;
    END LOOP;
END $$;


-- Sprint 6: Atualizar tabela products para corresponder à interface Product
-- A tabela atual (0001_init) tinha: id, tenant_id, name, price, stock, linked_service_id, active
ALTER TABLE products
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS category TEXT,
ADD COLUMN IF NOT EXISTS promo_price NUMERIC,
ADD COLUMN IF NOT EXISTS code TEXT,
ADD COLUMN IF NOT EXISTS min_stock INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS display_order INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
