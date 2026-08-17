-- Inserir plano padrão caso não exista nenhum com is_default = true
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM plans WHERE is_default = true) THEN
    INSERT INTO plans (key, name, description, max_professionals, allow_products, trial_days, sort_order, features, active, is_default)
    VALUES (
      'free_tier',
      'Plano Gratuito',
      'Acesso básico à plataforma.',
      1,
      false,
      0,
      0,
      '{"agenda": true, "equipe": true, "clientes": true, "produtos": false, "servicos": true, "financeiro": false, "relatorios": false, "custom_colors": false, "online_payments": false, "whatsapp_reminders": false}'::jsonb,
      true,
      true
    );
  END IF;
END $$;
