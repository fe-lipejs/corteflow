-- Migration 0081: Novas Permissões de Domicílio e Limites de Catálogo

-- 1. Inserir permissões de domicílio se não existirem
INSERT INTO public.sys_permissions (module, key, description, module_name)
VALUES
  ('equipe', 'equipe.domicilio', 'Permite habilitar atendimento a domicílio no perfil de um profissional', 'Equipe'),
  ('catalogo', 'catalogo.domicilio', 'Permite criar serviços com taxa de deslocamento/domicílio', 'Catálogo')
ON CONFLICT (key) DO NOTHING;

-- 2. Atualizar limites e permissões do plano Trial (Período de Teste)
UPDATE public.plans
SET 
  limits = jsonb_set(
             jsonb_set(
               COALESCE(limits, '{}'::jsonb),
               '{servicos}', '5'::jsonb
             ),
             '{produtos}', '5'::jsonb
           ),
  permissions = (
    SELECT jsonb_agg(DISTINCT p)
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(permissions, '[]'::jsonb)) as p
      UNION
      SELECT 'equipe.domicilio'
      UNION
      SELECT 'catalogo.domicilio'
    ) sub
  )
WHERE key = 'expired_tier' OR name = 'Trial (Período de Teste)';

-- 3. Atualizar limites do plano Solo (10 serviços, 0 produtos, sem domicílio)
UPDATE public.plans
SET 
  limits = jsonb_set(
             jsonb_set(
               COALESCE(limits, '{}'::jsonb),
               '{servicos}', '10'::jsonb
             ),
             '{produtos}', '0'::jsonb
           )
WHERE key = 'solo_tier' OR name = 'Solo';

-- 4. Atualizar limites dos planos Studio e Business (-1 para ilimitado, com domicílio)
UPDATE public.plans
SET 
  limits = jsonb_set(
             jsonb_set(
               COALESCE(limits, '{}'::jsonb),
               '{servicos}', '-1'::jsonb
             ),
             '{produtos}', '-1'::jsonb
           ),
  permissions = (
    SELECT jsonb_agg(DISTINCT p)
    FROM (
      SELECT jsonb_array_elements_text(COALESCE(permissions, '[]'::jsonb)) as p
      UNION
      SELECT 'equipe.domicilio'
      UNION
      SELECT 'catalogo.domicilio'
    ) sub
  )
WHERE key IN ('studio_tier', 'business_tier') OR name IN ('Studio', 'Business');
