'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  sendPhoneOtp,
  verifyPhoneOtp,
} from '@/lib/supabase/auth-handlers'

type Method = 'google' | 'email' | 'phone'
type EmailMode = 'signin' | 'signup'

export default function LoginPage() {
  const router = useRouter()
  const [method, setMethod] = useState<Method>('email')

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0A0B0D] text-[#F2F0EA]">
      {/* subtle garage-floor grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage:
            'linear-gradient(#F2F0EA 1px, transparent 1px), linear-gradient(90deg, #F2F0EA 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-16">
        <header className="mb-10 text-center">
          <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-[#FFB020]" />
          <h1
            className="text-3xl font-bold uppercase tracking-tight"
            style={{ fontFamily: '"Oswald", ui-sans-serif, system-ui' }}
          >
            Petrol Goons
          </h1>
          <p className="mt-1 text-sm text-[#8A8F98]">Sign in to your garage</p>
        </header>

        {/* Gauge-style segmented method selector */}
        <div className="mb-6 grid grid-cols-3 rounded-lg border border-[#1E2126] bg-[#111318] p-1">
          {(['google', 'email', 'phone'] as Method[]).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              className={`rounded-md py-2 text-xs font-semibold uppercase tracking-wide transition ${
                method === m
                  ? 'bg-[#FFB020] text-[#0A0B0D]'
                  : 'text-[#8A8F98] hover:text-[#F2F0EA]'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-[#1E2126] bg-[#111318] p-6">
          {method === 'google' && <GooglePanel />}
          {method === 'email' && <EmailPanel router={router} />}
          {method === 'phone' && <PhonePanel router={router} />}
        </div>

        <p className="mt-6 text-center text-xs text-[#8A8F98]">
          By continuing you agree to keep your bay tidy.
        </p>
      </div>
    </div>
  )
}

// ============================================================
// GOOGLE
// ============================================================

function GooglePanel() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const res = await signInWithGoogle()
    if (!res.success) {
      setError(res.error ?? 'Something went wrong')
      setLoading(false)
    }
    // On success, Supabase redirects the browser to Google — no further action here.
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#2A2E35] bg-[#F2F0EA] px-4 py-3 text-sm font-semibold text-[#0A0B0D] transition hover:bg-white disabled:opacity-50"
      >
        {loading ? 'Redirecting…' : 'Continue with Google'}
      </button>
      {error && <StatusLine tone="error">{error}</StatusLine>}
    </div>
  )
}

// ============================================================
// EMAIL / PASSWORD
// ============================================================

function EmailPanel({ router }: { router: ReturnType<typeof useRouter> }) {
  const [mode, setMode] = useState<EmailMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    if (mode === 'signup') {
      const res = await signUpWithEmail(email, password, fullName)
      setLoading(false)
      if (!res.success) return setError(res.error ?? 'Could not sign up')
      if (res.needsEmailConfirmation) {
        setNotice('Check your inbox to confirm your email, then sign in.')
        setMode('signin')
        return
      }
      router.replace('/') // middleware routes onward (onboarding or dashboard)
      router.refresh()
      return
    }

    const res = await signInWithEmail(email, password)
    setLoading(false)
    if (!res.success) return setError(res.error ?? 'Could not sign in')
    router.replace('/')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="mb-1 flex gap-4 text-xs">
        <button
          type="button"
          onClick={() => setMode('signin')}
          className={mode === 'signin' ? 'text-[#FFB020]' : 'text-[#8A8F98]'}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => setMode('signup')}
          className={mode === 'signup' ? 'text-[#FFB020]' : 'text-[#8A8F98]'}
        >
          Create account
        </button>
      </div>

      {mode === 'signup' && (
        <Input
          label="Full name"
          value={fullName}
          onChange={setFullName}
          placeholder="Jane Wanjiru"
        />
      )}
      <Input
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        placeholder="you@example.com"
        required
      />
      <Input
        label="Password"
        type="password"
        value={password}
        onChange={setPassword}
        placeholder="••••••••"
        required
        minLength={6}
      />

      <SubmitButton loading={loading}>
        {mode === 'signup' ? 'Create account' : 'Sign in'}
      </SubmitButton>

      {notice && <StatusLine tone="notice">{notice}</StatusLine>}
      {error && <StatusLine tone="error">{error}</StatusLine>}
    </form>
  )
}

// ============================================================
// PHONE OTP
// ============================================================

function PhonePanel({ router }: { router: ReturnType<typeof useRouter> }) {
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await sendPhoneOtp(phone)
    setLoading(false)
    if (!res.success) return setError(res.error ?? 'Could not send code')
    setStep('code')
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await verifyPhoneOtp(phone, code)
    setLoading(false)
    if (!res.success) return setError(res.error ?? 'Invalid code')
    router.replace('/')
    router.refresh()
  }

  if (step === 'phone') {
    return (
      <form onSubmit={handleSendCode} className="flex flex-col gap-3">
        <Input
          label="Phone number"
          type="tel"
          value={phone}
          onChange={setPhone}
          placeholder="+254712345678"
          required
        />
        <p className="text-xs text-[#8A8F98]">Use full international format, starting with +.</p>
        <SubmitButton loading={loading}>Send code</SubmitButton>
        {error && <StatusLine tone="error">{error}</StatusLine>}
      </form>
    )
  }

  return (
    <form onSubmit={handleVerify} className="flex flex-col gap-3">
      <p className="text-xs text-[#8A8F98]">
        Code sent to <span className="text-[#F2F0EA]">{phone}</span>
      </p>
      <Input
        label="6-digit code"
        value={code}
        onChange={setCode}
        placeholder="123456"
        required
        maxLength={6}
      />
      <SubmitButton loading={loading}>Verify & continue</SubmitButton>
      <button
        type="button"
        onClick={() => setStep('phone')}
        className="text-xs text-[#8A8F98] underline"
      >
        Use a different number
      </button>
      {error && <StatusLine tone="error">{error}</StatusLine>}
    </form>
  )
}

// ============================================================
// Small shared bits
// ============================================================

function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  minLength,
  maxLength,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  minLength?: number
  maxLength?: number
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-[#8A8F98]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className="rounded-md border border-[#2A2E35] bg-[#0A0B0D] px-3 py-2 text-sm text-[#F2F0EA] outline-none placeholder:text-[#5C616A] focus:border-[#FFB020]"
      />
    </label>
  )
}

function SubmitButton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="mt-1 rounded-md bg-[#FFB020] px-4 py-2.5 text-sm font-semibold text-[#0A0B0D] transition hover:bg-[#FFC24D] disabled:opacity-50"
    >
      {loading ? 'Working…' : children}
    </button>
  )
}

function StatusLine({ tone, children }: { tone: 'error' | 'notice'; children: React.ReactNode }) {
  const color = tone === 'error' ? '#FF6B4A' : '#00E5C7'
  return (
    <p className="mt-1 flex items-center gap-2 text-xs" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {children}
    </p>
  )
}
