export const supabase = {
  auth: {
    async getSession() { return { data: { session: { user: { id: 'stub' } } } } },
    async signInWithPassword(_creds: any) { return { data: { user: { id: 'stub' }, session: null }, error: null } },
    async signOut() { return }
  },
  from(_table: string) {
    return {
      select: (_q?: string) => ({
        eq: (_field: string, _value?: any) => ({ single: async () => ({ data: { id: String(_value || 'stub'), is_active: true, pin_hash: null }, error: null }) }),
        update: async () => ({ data: null, error: null }),
      }),
      
    }
  },
  rpc() { return { data: null, error: null } }
}
