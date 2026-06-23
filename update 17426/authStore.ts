import { create } from 'zustand';
import { createStorage } from '../config/storage';
import { supabase } from '../config/supabase';
import type { User } from '../types';

const storage = createStorage('duka-auth');

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPinLocked: boolean;
  pinAttempts: number;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  lockScreen: () => void;
  unlockWithPin: (pin: string) => Promise<{ error: string | null }>;
  resetPinAttempts: () => void;
  setUser: (user: User | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  isPinLocked: false,
  pinAttempts: 0,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: userData } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userData && userData.is_active) {
          set({
            user: userData as User,
            session,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }
      }
      set({ isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        set({ isLoading: false });
        return { error: error.message };
      }

      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (userError || !userData) {
        set({ isLoading: false });
        return { error: 'User profile not found. Contact your administrator.' };
      }

      if (!userData.is_active) {
        await supabase.auth.signOut();
        set({ isLoading: false });
        return { error: 'Account is deactivated. Contact admin.' };
      }

      await supabase
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', data.user.id);

      set({
        user: userData as User,
        session: data.session,
        isAuthenticated: true,
        isLoading: false,
        isPinLocked: false,
        pinAttempts: 0,
      });

      return { error: null };
    } catch {
      set({ isLoading: false });
      return { error: 'An unexpected error occurred.' };
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    storage.clearAll();
    set({
      user: null,
      session: null,
      isAuthenticated: false,
      isPinLocked: false,
      pinAttempts: 0,
    });
  },

  // FIX: Only lock screen if user has a PIN set up
  lockScreen: () => {
    const { user } = get();
    if (user?.pin_hash) {
      set({ isPinLocked: true });
    }
    // If no pin_hash, skip the lock — prevents infinite loop for new users
  },

  unlockWithPin: async (pin: string) => {
    const { user, pinAttempts } = get();
    if (!user) return { error: 'No user session.' };

    // FIX: If user has no PIN set, auto-unlock (don't call RPC with null hash)
    if (!user.pin_hash) {
      set({ isPinLocked: false, pinAttempts: 0 });
      return { error: null };
    }

    try {
      const { data, error } = await supabase.rpc('verify_pin', {
        user_id: user.id,
        pin_input: pin,
      });

      if (error || !data) {
        const newAttempts = pinAttempts + 1;
        set({ pinAttempts: newAttempts });

        if (newAttempts >= 3) {
          await get().signOut();
          return { error: 'Too many failed attempts. Please sign in again.' };
        }
        return { error: `Invalid PIN. ${3 - newAttempts} attempt${3 - newAttempts !== 1 ? 's' : ''} remaining.` };
      }

      set({ isPinLocked: false, pinAttempts: 0 });
      return { error: null };
    } catch {
      return { error: 'Could not verify PIN. Check your connection.' };
    }
  },

  resetPinAttempts: () => set({ pinAttempts: 0 }),
  setUser: (user) => set({ user }),
}));
