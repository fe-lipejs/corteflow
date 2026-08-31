ALTER TABLE public.billing_events 
ADD COLUMN IF NOT EXISTS history_id UUID REFERENCES public.commercial_history(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS event_type TEXT,
ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}'::jsonb;
