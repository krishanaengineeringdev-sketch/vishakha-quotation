import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { COMPANY_CONFIG } from '../config/companyConfig';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(!isSupabaseConfigured);

  useEffect(() => {
    if (isSupabaseConfigured && supabase) {
      // 1. Get initial session
      supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
        setSession(initialSession);
        setUser(initialSession?.user ?? null);
        setIsDemoMode(false);
        setLoading(false);
      }).catch((err) => {
        console.warn('Error fetching Supabase session:', err);
        // Fallback to checking local demo auth
        checkLocalDemoAuth();
      });

      // 2. Listen for auth state changes
      const {
        data: { subscription }
      } = supabase.auth.onAuthStateChange((_event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      });

      return () => {
        subscription.unsubscribe();
      };
    } else {
      checkLocalDemoAuth();
    }
  }, []);

  const checkLocalDemoAuth = () => {
    const demoUser = localStorage.getItem('vishakha_demo_user');
    if (demoUser) {
      try {
        const parsed = JSON.parse(demoUser);
        setUser(parsed);
        setSession({ user: parsed, access_token: 'demo-token' });
      } catch (e) {
        setUser(null);
        setSession(null);
      }
    }
    setIsDemoMode(true);
    setLoading(false);
  };

  const signIn = async (email, password) => {
    if (isSupabaseConfigured && supabase && !isDemoMode) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      setUser(data.user);
      setSession(data.session);
      return data;
    }

    // Demo Mode Sign In
    const demoObj = {
      id: 'demo-user-1',
      email: email || COMPANY_CONFIG.email,
      user_metadata: { name: COMPANY_CONFIG.name }
    };
    localStorage.setItem('vishakha_demo_user', JSON.stringify(demoObj));
    setUser(demoObj);
    setSession({ user: demoObj, access_token: 'demo-token' });
    return { user: demoObj, session: { access_token: 'demo-token' } };
  };

  const signUp = async (email, password) => {
    if (isSupabaseConfigured && supabase && !isDemoMode) {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });
      if (error) throw error;
      return data;
    }

    // Demo Mode Sign Up
    return signIn(email, password);
  };

  const signOut = async () => {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Supabase sign out error:', e);
      }
    }
    localStorage.removeItem('vishakha_demo_user');
    setUser(null);
    setSession(null);
  };

  const value = {
    user,
    session,
    loading,
    isDemoMode,
    signIn,
    signUp,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
