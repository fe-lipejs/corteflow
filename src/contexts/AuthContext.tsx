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

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
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
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profErr) {
        console.error('Error fetching profile:', profErr);
      } else if (prof) {
        setProfile(prof);
        let resolvedTenantId = (prof as any)?.tenant_id;

        if (prof.role === 'professional' && !resolvedTenantId) {
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
          }
        }

        if (prof.role === 'super_admin') {
          setMemberships([]);
        } else {
          const { data: memData } = await supabase
            .from('tenant_users')
            .select('*, tenants(*)')
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
