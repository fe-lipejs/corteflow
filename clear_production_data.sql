-- =========================================================================
-- SCRIPT DE LIMPEZA PARA PRODUÇÃO
-- Este script apaga todos os dados de rastreamento (analytics) e 
-- remove 100% da conta e dos dados vinculados à usuária Maria.
-- 
-- IMPORTANTE: Cole e rode isso no "SQL Editor" do Supabase.
-- =========================================================================

DO $$
DECLARE
    target_user_id UUID;
    target_tenant_id UUID;
BEGIN
    -- =========================================================================
    -- 1. LIMPAR TODOS OS DADOS DE ANALYTICS E RASTREAMENTO
    -- =========================================================================
    RAISE NOTICE 'Limpando tabela analytics_events...';
    TRUNCATE TABLE public.analytics_events;
    
    -- =========================================================================
    -- 2. ENCONTRAR E APAGAR A USUÁRIA mariafsj2310@gmail.com E SEUS DADOS
    -- =========================================================================
    SELECT id INTO target_user_id 
    FROM auth.users 
    WHERE email = 'mariafsj2310@gmail.com';

    IF target_user_id IS NOT NULL THEN
        RAISE NOTICE 'Usuária encontrada com ID: %', target_user_id;
        
        -- Encontrar todos os tenants (salões) dessa usuária e varrer tudo
        FOR target_tenant_id IN 
            SELECT id FROM public.tenants WHERE owner_user_id = target_user_id
        LOOP
            RAISE NOTICE 'Limpando dados do salão ID: %', target_tenant_id;
            
            -- Deletar todas as tabelas filhas (para evitar bloqueios de Foreign Key)
            DELETE FROM public.support_tickets WHERE tenant_id = target_tenant_id;
            DELETE FROM public.stripe_connect_accounts WHERE tenant_id = target_tenant_id;
            DELETE FROM public.subscriptions WHERE tenant_id = target_tenant_id;
            DELETE FROM public.financial_transactions WHERE tenant_id = target_tenant_id;
            DELETE FROM public.bookings WHERE tenant_id = target_tenant_id;
            DELETE FROM public.customers WHERE tenant_id = target_tenant_id;
            DELETE FROM public.products WHERE tenant_id = target_tenant_id;
            DELETE FROM public.services WHERE tenant_id = target_tenant_id;
            DELETE FROM public.professionals WHERE tenant_id = target_tenant_id;
            DELETE FROM public.custom_pricing WHERE tenant_id = target_tenant_id;
            DELETE FROM public.business_hours WHERE tenant_id = target_tenant_id;
            DELETE FROM public.blocked_times WHERE tenant_id = target_tenant_id;
            DELETE FROM public.notification_settings WHERE tenant_id = target_tenant_id;
            DELETE FROM public.tenant_settings WHERE tenant_id = target_tenant_id;
            
            -- Deletar todos os perfis (funcionários/donos) atrelados a este salão
            DELETE FROM public.profiles WHERE tenant_id = target_tenant_id;
            
            -- Por fim, deletar o salão principal
            DELETE FROM public.tenants WHERE id = target_tenant_id;
        END LOOP;

        RAISE NOTICE 'Limpando dados de autenticação do Supabase...';
        
        -- Garantir a deleção do profile principal (caso estivesse sem tenant)
        DELETE FROM public.profiles WHERE id = target_user_id;

        -- Deletar do sistema de Auth do Supabase (Sessões e Identidades Sociais)
        DELETE FROM auth.identities WHERE user_id = target_user_id;
        DELETE FROM auth.mfa_factors WHERE user_id = target_user_id;
        DELETE FROM auth.sessions WHERE user_id = target_user_id;
        
        -- Deletar a conta principal de usuário
        DELETE FROM auth.users WHERE id = target_user_id;

        RAISE NOTICE '✅ SUCESSO: Usuária mariafsj2310@gmail.com e TODOS os seus dados foram deletados!';
    ELSE
        RAISE NOTICE '⚠️ AVISO: Usuária mariafsj2310@gmail.com não foi encontrada no banco de dados. Pode já ter sido deletada.';
    END IF;
END $$;
