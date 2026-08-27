import { useQuery } from '@tanstack/react-query';
import { supabase } from '../integrations/supabase/client';

export type AccountState = 
  | 'onboarding_no_card'
  | 'trialing_with_card'
  | 'active'
  | 'past_due'
  | 'locked'
  | 'canceled';

export interface TenantAccount {
  id: string;
  account_state: AccountState;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  past_due_since: string | null;
}

export function useAccountState() {
  const { data: profile } = useQuery({
    queryKey: ['user-profile-account'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data } = await supabase.from('profiles').select('tenant_id').eq('id', user.id).single();
      return data;
    },
  });

  const tenantId = profile?.tenant_id;

  return useQuery({
    queryKey: ['tenant-account-state', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, account_state, trial_started_at, trial_ends_at, past_due_since')
        .eq('id', tenantId)
        .single();
        
      if (error) throw error;
      return data as TenantAccount;
    },
    // Refetch less frequently to save reads, but enough to catch updates
    staleTime: 60000, 
  });
}
