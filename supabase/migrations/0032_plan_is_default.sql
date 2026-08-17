-- Migration: 0032_plan_is_default.sql
-- Adiciona flag is_default na tabela plans para permitir configurar o plano gratuito/padrão

ALTER TABLE plans ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;

-- Garante que apenas um plano pode ser o padrão por vez
DROP INDEX IF EXISTS plans_one_default_idx;
CREATE UNIQUE INDEX plans_one_default_idx ON plans (is_default) WHERE is_default = true;
