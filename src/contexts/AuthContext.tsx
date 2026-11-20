import React, { createContext, useEffect, useRef, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import type { Database, UserRole, Professional } from '../types/database';
import { useQueryClient } from '@tanstack/react-query';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  tenant: Tenant | null;
  tenantId: string | null;
  role: Profile['role'] | null;
  onboardingCompleted: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  professionalProfile: Professional | null;
  professionalPermissions: Record<string, boolean> | null;
  forcePasswordChange: boolean;
  memberships: any[];
  switchTenantContext: (tenantId: string) => Promise<void>;
  pendingTenantSelection: any[];
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [professionalProfile, setProfessionalProfile] = useState<Professional | null>(null);
  const [professionalPermissions, setProfessionalPermissions] = useState<Record<string, boolean> | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [memberships, setMemberships] = useState<any[]>([]);
  const [pendingTenantSelection, setPendingTenantSelection] = useState<any[]>([]);
  const permChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const subscribeToPermissions = (userId: string) => {
    if (permChannelRef.current) {
      supabase.removeChannel(permChannelRef.current);
      permChannelRef.current = null;
    }
    const channel = supabase
      .channel(`prof-permissions-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'professionals',
        filter: `auth_user_id=eq.${userId}`,
      }, (payload) => {
        const updated = payload.new as any;
        if (updated.permissions) {
          setProfessionalPermissions(updated.permissions as Record<string, boolean>);
        }
        if (updated.active === false) {
          supabase.auth.signOut();
        }
      })
      .subscribe();
    permChannelRef.current = channel;
  };

  const AUTH_CACHE_PREFIX = 'raffros_auth_cache_';

  const saveAuthCache = (userId: string, data: { profile?: any; tenant?: any }) => {
    try {
      const prevRaw = localStorage.getItem(`${AUTH_CACHE_PREFIX}${userId}`);
      const prev = prevRaw ? JSON.parse(prevRaw) : {};
      localStorage.setItem(
        `${AUTH_CACHE_PREFIX}${userId}`,
        JSON.stringify({ ...prev, ...data, updatedAt: Date.now() })
      );
    } catch {
      // ignore storage errors
    }
  };

  const readAuthCache = (userId: string): { profile?: any; tenant?: any } | null => {
    try {
      const raw = localStorage.getItem(`${AUTH_CACHE_PREFIX}${userId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let isBootstrapping = true;

    const isNetworkFailure = (err: any) => {
      const msg = String(err?.message || err || '').toLowerCase();
      return (
        err?.name === 'AuthRetryableFetchError' ||
        msg.includes('failed to fetch') ||
        msg.includes('load failed') ||
        msg.includes('networkerror')
      );
    };

    // Recupera a sessão com novas tentativas em caso de falha de rede,
    // evitando que o usuário seja "deslogado" só porque a conexão oscilou.
    const loadInitialSession = async (attempt = 1): Promise<void> => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!session && error && isNetworkFailure(error) && attempt < 4) {
        await new Promise((r) => setTimeout(r, 800 * attempt));
        return loadInitialSession(attempt + 1);
      }
      isBootstrapping = false;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    };

    loadInitialSession().catch(() => {
      isBootstrapping = false;
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Durante o boot, se INITIAL_SESSION vier nulo por falha momentânea de rede,
      // aguardamos as retentativas do loadInitialSession antes de derrubar a sessão.
      if (event === 'INITIAL_SESSION' && !session && isBootstrapping) {
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (event !== 'TOKEN_REFRESHED') {
          fetchProfile(session.user.id);
        }
      } else {
        setProfile(null);
        setTenant(null);
        setProfessionalProfile(null);
        setProfessionalPermissions(null);
        setForcePasswordChange(false);
        setPendingTenantSelection([]);
        if (permChannelRef.current) {
          supabase.removeChannel(permChannelRef.current);
          permChannelRef.current = null;
        }
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (permChannelRef.current) {
        supabase.removeChannel(permChannelRef.current);
      }
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      let prof: any = null;
      let profErr: any = null;
      // Até 3 tentativas para falhas de rede (oscilação 4G / rota bloqueada)
      for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        prof = res.data;
        profErr = res.error;
        const msg = String(profErr?.message || '').toLowerCase();
        const isNet = msg.includes('failed to fetch') || msg.includes('load failed') || msg.includes('networkerror');
        if (!profErr || !isNet) break;
        await new Promise((r) => setTimeout(r, 700 * attempt));
      }

      if (profErr) {
        console.error('Error fetching profile:', profErr);
        // Se todas as tentativas falharem por rede, restaura o último perfil/salão conhecido do cache
        // para que o dono não perca o acesso nem seja forçado a relogar.
        const cached = readAuthCache(userId);
        if (cached?.profile) {
          setProfile(cached.profile);
          if (cached.tenant) setTenant(cached.tenant);
        }
      } else if (prof) {
        setProfile(prof);
        saveAuthCache(userId, { profile: prof });
        let resolvedTenantId = (prof as any)?.tenant_id;

        if ((prof.role === 'professional' || !resolvedTenantId) && prof.role !== 'super_admin') {
          const { data: activeMemberships } = await supabase
            .from('tenant_users')
            .select('tenant_id, role, status, tenants(id, name, business_type, slug)')
            .eq('user_id', userId)
            .eq('status', 'active');

          const validMemberships = (activeMemberships || []).filter(
            (m: any) => m.tenants && m.status === 'active'
          );

          if (validMemberships.length > 1) {
            setPendingTenantSelection(validMemberships);
            setLoading(false);
            return;
          } else if (validMemberships.length === 1) {
            resolvedTenantId = validMemberships[0].tenant_id;
          }
        }

        setPendingTenantSelection([]);

        if (prof.role === 'professional' && resolvedTenantId) {
          const { data: profRecord, error: profRecordErr } = await supabase
            .from('professionals')
            .select('*')
            .eq('auth_user_id', userId)
            .eq('tenant_id', resolvedTenantId)
            .maybeSingle();
          if (profRecord && !profRecordErr) {
            setProfessionalProfile(profRecord as Professional);
            setProfessionalPermissions((profRecord.permissions as Record<string, boolean>) || null);
            setForcePasswordChange(!!profRecord.force_password_change);
            subscribeToPermissions(userId);
          } else {
            setProfessionalProfile(null);
            setProfessionalPermissions(null);
          }
        }

        if (resolvedTenantId) {
          const { data: tenData, error: tenErr } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', resolvedTenantId)
            .maybeSingle();
          if (!tenErr && tenData) {
            setTenant(tenData as any);
            saveAuthCache(userId, { tenant: tenData });
          } else if (tenErr) {
            const cached = readAuthCache(userId);
            if (cached?.tenant) setTenant(cached.tenant);
          }
        }

        if (prof.role === 'super_admin') {
          setMemberships([]);
        } else {
          const { data: memData } = await supabase
            .from('tenant_users')
            .select('*, tenants(*, tenant_settings(logo_url))')
            .eq('user_id', userId)
            .eq('status', 'active');
          if (memData) setMemberships(memData);
        }
      } else {
        setProfile(null);
        setTenant(null);
        setProfessionalProfile(null);
        setProfessionalPermissions(null);
        setForcePasswordChange(false);
        setPendingTenantSelection([]);
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (permChannelRef.current) {
      supabase.removeChannel(permChannelRef.current);
      permChannelRef.current = null;
    }
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user?.id) await fetchProfile(user.id);
  };

  const switchTenantContext = async (newTenantId: string) => {
    setLoading(true);
    // MED-06: Limpar seleção pendente ANTES do fetchProfile para não re-mostrar o seletor
    setPendingTenantSelection([]);
    try {
      const { error } = await supabase.rpc('switch_tenant', { p_tenant_id: newTenantId });
      if (error) throw error;
      queryClient.clear();
      if (user?.id) await fetchProfile(user.id);
    } catch (err) {
      console.error('Error switching tenant:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };


  const value: AuthContextType = {
    session,
    user,
    profile,
    tenant,
    tenantId: tenant?.id || profile?.tenant_id || null,
    role: (profile?.role === 'super_admin') ? 'super_admin' : (profile?.role as UserRole) || null,
    onboardingCompleted: Boolean(profile?.onboarding_completed),
    loading,
    signOut,
    refreshProfile,
    professionalProfile,
    professionalPermissions,
    forcePasswordChange,
    memberships,
    switchTenantContext,
    pendingTenantSelection,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
