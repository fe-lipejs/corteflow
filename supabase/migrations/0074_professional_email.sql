-- Migration 0074: Adicionar email e controle de convite aos profissionais

ALTER TABLE professionals
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS invite_status TEXT DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'rejected'));

-- Atualiza profissionais antigos que já têm auth_user_id para accepted
UPDATE professionals 
SET invite_status = 'accepted' 
WHERE auth_user_id IS NOT NULL;
