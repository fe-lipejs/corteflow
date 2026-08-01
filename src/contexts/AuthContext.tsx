import React, { createContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../integrations/supabase/client';
import type { Database } from '../types/database';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Tenant = Database['public']['Tables']['tenants']['Row'];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  tenant: Tenant | null;
  tenantId: string | null;
  role: Profile['role'] | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

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

        if ((prof as any)?.tenant_id) {
          const { data: tenData, error: tenErr } = await supabase
            .from('tenants')
            .select('*')
            .eq('id', (prof as any).tenant_id)
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
    tenantId: profile?.tenant_id ?? null,
    role: profile?.role ?? null,
    loading,
    signOut,
    refreshProfile,
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
