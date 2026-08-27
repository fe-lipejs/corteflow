
-- SCRIPT DE DELEÇÃO EM MASSA - PERIGO!
-- Este script irá deletar absolutamente todos os usuários do banco de dados e tudo atrelado a eles (clientes, agendamentos, profissionais, etc),
-- com a ÚNICA EXCEÇÃO do usuário felipejsf7@gmail.com.

DO $$
DECLARE
  target_user_id UUID;
  t_record RECORD;
BEGIN
  -- 1. Encontra o ID do usuário que queremos MANTER (o dono)
  SELECT id INTO target_user_id FROM auth.users WHERE email = 'felipejsf7@gmail.com' LIMIT 1;
  
  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário felipejsf7@gmail.com não encontrado. Operação abortada por segurança.';
  END IF;

  -- 2. Varre todos os tenants que NÃO pertencem ao dono e limpa suas tabelas filhas primeiro (evitando erros de Foreign Key)
  FOR t_record IN (SELECT id FROM public.tenants WHERE owner_user_id != target_user_id) LOOP
    DELETE FROM public.stripe_connect_accounts WHERE tenant_id = t_record.id;
    DELETE FROM public.subscriptions WHERE tenant_id = t_record.id;
    DELETE FROM public.tenant_settings WHERE tenant_id = t_record.id;
    DELETE FROM public.business_hours WHERE tenant_id = t_record.id;
    DELETE FROM public.blocked_times WHERE tenant_id = t_record.id;
    DELETE FROM public.financial_transactions WHERE tenant_id = t_record.id;
    DELETE FROM public.bookings WHERE tenant_id = t_record.id;
    DELETE FROM public.customers WHERE tenant_id = t_record.id;
    DELETE FROM public.products WHERE tenant_id = t_record.id;
    DELETE FROM public.services WHERE tenant_id = t_record.id;
    DELETE FROM public.professionals WHERE tenant_id = t_record.id;
    DELETE FROM public.notification_settings WHERE tenant_id = t_record.id;
    DELETE FROM public.custom_pricing WHERE tenant_id = t_record.id;
    
    -- Deleta os perfis de profissionais vinculados a este tenant antes de matar o tenant
    DELETE FROM public.profiles WHERE tenant_id = t_record.id;
    -- Deleta o tenant
    DELETE FROM public.tenants WHERE id = t_record.id;
  END LOOP;

  -- 3. Apaga qualquer perfil (profile) que ainda tenha sobrado e que não seja o do dono
  DELETE FROM public.profiles WHERE id != target_user_id;

  -- 4. Limpa as tabelas auxiliares de autenticação (segurança extra contra orfãos)
  DELETE FROM auth.identities WHERE user_id != target_user_id;
  DELETE FROM auth.mfa_factors WHERE user_id != target_user_id;
  DELETE FROM auth.sessions WHERE user_id != target_user_id;
  
  -- 5. Finalmente, deleta da tabela principal de autenticação todos os usuários exceto o dono
  DELETE FROM auth.users WHERE id != target_user_id;

END $$;
