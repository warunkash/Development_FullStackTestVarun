import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Doctor } from '../types';
import { mockDoctor } from '../data/mockPatients';

const AUTH_STORAGE_KEY = 'ai-medical-scribe/auth-doctor';

interface AuthContextValue {
  doctor: Doctor | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(AUTH_STORAGE_KEY)
      .then((raw) => {
        if (raw) setDoctor(JSON.parse(raw));
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    // NOTE: this is a local mock for demo purposes. A production build would
    // call POST /auth/login on the FastAPI backend and store a JWT/session token.
    if (!email.trim() || !password.trim()) {
      return { success: false, error: 'Enter your email and password.' };
    }
    if (password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters.' };
    }
    const authenticated: Doctor = { ...mockDoctor, email };
    await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authenticated));
    setDoctor(authenticated);
    return { success: true };
  };

  const logout = async () => {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    setDoctor(null);
  };

  const value = useMemo(() => ({ doctor, isLoading, login, logout }), [doctor, isLoading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
