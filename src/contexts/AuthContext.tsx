import React, { createContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import type { Database, UserRole, Professional } from '../types/database';

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
  // Professional Access
  professionalProfile: Professional | null;
  professionalPermissions: Record<string, boolean> | null;
  forcePasswordChange: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [professionalProfile, setProfessionalProfile] = useState<Professional | null>(null);
  const [professionalPermissions, setProfessionalPermissions] = useState<Record<string, boolean> | null>(null);
  const [forcePasswordChange, setForcePasswordChange] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
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
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
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

        if (prof.role === 'professional') {
          // Fetch professional record
          const { data: profRecord, error: profRecordErr } = await supabase
            .from('professionals')
            .select('*')
            .eq('auth_user_id', userId)
            .maybeSingle();
            
          if (profRecord && !profRecordErr) {
            setProfessionalProfile(profRecord as Professional);
            setProfessionalPermissions((profRecord.permissions as Record<string, boolean>) || null);
            setForcePasswordChange(!!profRecord.force_password_change);
            resolvedTenantId = profRecord.tenant_id;
          }
        }

        if (resolvedTenantId) {
          const { data: tenData, error: tenErr } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', resolvedTenantId)
            .maybeSingle();
          const ten = tenData as any;
            
          if (!tenErr && ten) {
            setTenant(ten);
          }
        }
      } else {
        // If no profile yet (e.g. during onboarding before upsert finishes), reset to null
        setProfile(null);
        setTenant(null);
        setProfessionalProfile(null);
        setProfessionalPermissions(null);
        setForcePasswordChange(false);
      }
    } catch (err) {
      console.error('Error in fetchProfile:', err);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfile(user.id);
    }
  };

  const value: AuthContextType = {
    session,
    user,
    profile,
    tenant,
    tenantId: tenant?.id || profile?.tenant_id || null,
    role: (profile?.role as UserRole) || (profile?.tenant_id ? 'admin' : null),
    onboardingCompleted: Boolean(profile?.onboarding_completed || profile?.tenant_id),
    loading,
    signOut,
    refreshProfile,
    professionalProfile,
    professionalPermissions,
    forcePasswordChange
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

