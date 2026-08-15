-- Function to permanently delete a tenant and its owner user completely
CREATE OR REPLACE FUNCTION hard_delete_tenant_and_user(p_tenant_id UUID, p_user_id UUID)
RETURNS void AS $$
BEGIN
    -- 1. Exclui todas as tabelas filhas vinculadas ao tenant
    DELETE FROM stripe_connect_accounts WHERE tenant_id = p_tenant_id;
    DELETE FROM subscriptions WHERE tenant_id = p_tenant_id;
    DELETE FROM tenant_settings WHERE tenant_id = p_tenant_id;
    DELETE FROM business_hours WHERE tenant_id = p_tenant_id;
    DELETE FROM blocked_times WHERE tenant_id = p_tenant_id;
    DELETE FROM financial_transactions WHERE tenant_id = p_tenant_id;
    DELETE FROM bookings WHERE tenant_id = p_tenant_id;
    DELETE FROM customers WHERE tenant_id = p_tenant_id;
    DELETE FROM products WHERE tenant_id = p_tenant_id;
    DELETE FROM services WHERE tenant_id = p_tenant_id;
    DELETE FROM professionals WHERE tenant_id = p_tenant_id;
    DELETE FROM notification_settings WHERE tenant_id = p_tenant_id;
    DELETE FROM custom_pricing WHERE tenant_id = p_tenant_id;
    
    -- 2. Exclui o perfil do usuário
    DELETE FROM profiles WHERE id = p_user_id OR tenant_id = p_tenant_id;
    
    -- 3. Exclui o tenant
    DELETE FROM tenants WHERE id = p_tenant_id;

    -- 4. Exclui permanentemente o usuário da tabela auth.users
    DELETE FROM auth.users WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
