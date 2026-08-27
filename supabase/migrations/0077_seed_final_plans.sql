
-- LIMPEZA GERAL DE PLANOS ANTIGOS
-- Eles são mantidos no banco por questões de chave estrangeira, mas inativados.
UPDATE public.plans 
SET 
  active = false, 
  is_default = false 
WHERE active = true OR is_default = true;

-- Criação do Plano Expirado (Default fallback)
INSERT INTO public.plans (
  key, name, description, max_professionals, allow_products, trial_days, sort_order, features, permissions, limits, active, is_default
) VALUES (
  'expired_tier',
  'Plano Expirado',
  'Sua assinatura expirou. Assine um plano para voltar a acessar o sistema.',
  0,
  false,
  0,
  0,
  '{"agenda": false, "equipe": false, "clientes": false, "produtos": false, "servicos": false, "financeiro": false, "relatorios": false}'::jsonb,
  '[]'::jsonb,
  '{"profissionais": 0}'::jsonb,
  false,
  true
);

-- Ativa/Reinsere o Plano Solo
WITH novo_solo AS (
  INSERT INTO public.plans (
    key, name, description, max_professionals, allow_products, trial_days, sort_order, features, permissions, limits, active, is_default
  ) VALUES (
    'solo_tier',
    'Solo',
    'Ideal para o barbeiro autônomo. Agenda, clientes e financeiro básico.',
    1,
    false,
    7,
    1,
    '{"agenda": true, "equipe": false, "clientes": true, "produtos": false, "servicos": true, "financeiro": true, "relatorios": false}'::jsonb,
    '["*"]'::jsonb,
    '{"profissionais": 1}'::jsonb,
    true,
    false
  ) RETURNING id
)
INSERT INTO public.plan_prices (plan_id, country_code, currency, amount, stripe_price_id)
SELECT id, 'BR', 'BRL', 50, 'price_1U8oxn8dE283e6kosbcOKp2Z' FROM novo_solo UNION ALL
SELECT id, 'US', 'USD', 15, 'price_1U8oxn8dE283e6kosbcOKp2Z' FROM novo_solo UNION ALL
SELECT id, 'ES', 'EUR', 15, 'price_1U8oxn8dE283e6kosbcOKp2Z' FROM novo_solo;

-- Ativa/Reinsere o Plano Studio
WITH novo_studio AS (
  INSERT INTO public.plans (
    key, name, description, max_professionals, allow_products, trial_days, sort_order, features, permissions, limits, active, is_default
  ) VALUES (
    'studio_tier',
    'Studio',
    'Para salões em crescimento. Até 5 profissionais, controle de produtos e comissões.',
    5,
    true,
    7,
    2,
    '{"agenda": true, "equipe": true, "clientes": true, "produtos": true, "servicos": true, "financeiro": true, "relatorios": false}'::jsonb,
    '["*"]'::jsonb,
    '{"profissionais": 5}'::jsonb,
    true,
    false
  ) RETURNING id
)
INSERT INTO public.plan_prices (plan_id, country_code, currency, amount, stripe_price_id)
SELECT id, 'BR', 'BRL', 100, 'price_1U8pf28dE283e6koAJIGkIap' FROM novo_studio UNION ALL
SELECT id, 'US', 'USD', 29, 'price_1U8pf28dE283e6koAJIGkIap' FROM novo_studio UNION ALL
SELECT id, 'ES', 'EUR', 29, 'price_1U8pf28dE283e6koAJIGkIap' FROM novo_studio;

-- Ativa/Reinsere o Plano Business
WITH novo_business AS (
  INSERT INTO public.plans (
    key, name, description, max_professionals, allow_products, trial_days, sort_order, features, permissions, limits, active, is_default
  ) VALUES (
    'business_tier',
    'Business',
    'O pacote completo para grandes operações. Ilimitado e irrestrito.',
    999,
    true,
    7,
    3,
    '{"agenda": true, "equipe": true, "clientes": true, "produtos": true, "servicos": true, "financeiro": true, "relatorios": true}'::jsonb,
    '["*"]'::jsonb,
    '{"profissionais": -1}'::jsonb,
    true,
    false
  ) RETURNING id
)
INSERT INTO public.plan_prices (plan_id, country_code, currency, amount, stripe_price_id)
SELECT id, 'BR', 'BRL', 150, 'price_1U8phO8dE283e6kofmM8ElFK' FROM novo_business UNION ALL
SELECT id, 'US', 'USD', 49, 'price_1U8phO8dE283e6kofmM8ElFK' FROM novo_business UNION ALL
SELECT id, 'ES', 'EUR', 49, 'price_1U8phO8dE283e6kofmM8ElFK' FROM novo_business;
