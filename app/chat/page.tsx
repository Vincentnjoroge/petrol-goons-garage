'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  Conversation,
  GARAGE_SIDE,
  resolveMySideKey,
  subscribeToMyConversations,
  subscribeToGarageConversations,
} from '@/lib/chat'
import type { UserProfile } from '@/lib/types'

function timeAgo(ts: any): string {
  if (!ts?.toDate) return ''
  const diff = Date.now() - (ts.toDate() as Date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d`
  return (ts.toDate() as Date).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

const typeBadge: Record<string, { label: string; cls: string }> = {
  customer_garage: { label: 'Garage', cls: 'bg-petrol-yellow/10 text-petrol-black' },
  customer_specialist: { label: 'Specialist', cls: 'bg-blue-50 text-blue-700' },
  garage_specialist: { label: 'Specialist', cls: 'bg-blue-50 text-blue-700' },
}

export default function ChatListPage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      setAuthChecked(true)
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null)
      } else {
        setLoading(false)
      }
    })
    return () => unsub()
  }, [])

  const isGarageStaff = !!profile?.garageId && profile?.role !== 'customer' && profile?.role !== 'independent_specialist'

  useEffect(() => {
    if (!user) return
    let unsub: (() => void) | undefined
    if (isGarageStaff && profile?.garageId) {
      unsub = subscribeToGarageConversations(profile.garageId, (c) => { setConversations(c); setLoading(false) })
    } else {
      // customers AND specialists are participants
      unsub = subscribeToMyConversations(user.uid, (c) => { setConversations(c); setLoading(false) })
    }
    return () => unsub?.()
  }, [user, profile, isGarageStaff])

  if (authChecked && !user) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-[430px] mx-auto flex flex-col items-center justify-center px-8 text-center">
        <ChatIcon className="text-petrol-yellow mb-3" />
        <h1 className="text-xl font-bold text-petrol-black mb-2">Messages</h1>
        <p className="text-sm text-gray-500 mb-6">Sign in to start chatting.</p>
        <button onClick={() => router.push('/')} className="bg-petrol-yellow text-petrol-black font-semibold rounded-xl px-6 py-3">Sign In</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 max-w-[430px] mx-auto relative">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="flex items-center px-4 pt-3 pb-3">
          <button onClick={() => router.back()} className="text-petrol-black p-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <h1 className="flex-1 text-center text-xl font-extrabold text-petrol-black pr-[22px]">Messages</h1>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-petrol-yellow border-t-transparent rounded-full animate-spin" /></div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-8 py-24 text-center">
          <ChatIcon className="text-petrol-yellow mb-3" />
          <h2 className="text-base font-bold text-petrol-black mb-1">No conversations yet</h2>
          <p className="text-sm text-gray-500">
            {isGarageStaff ? 'Customer and specialist messages appear here.'
              : profile?.role === 'independent_specialist' ? 'Consultations with customers and garages appear here.'
              : 'Message a garage or book a specialist consult.'}
          </p>
          {profile?.role !== 'independent_specialist' && !isGarageStaff && (
            <button onClick={() => router.push('/specialists')} className="mt-5 text-sm font-semibold text-petrol-black bg-petrol-yellow rounded-xl px-5 py-2.5">
              Find a Specialist
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {conversations.map((c) => {
            const mySide = resolveMySideKey(c, user!.uid, profile?.garageId)
            if (!mySide) return null
            const otherKey = c.sideKeys.find((k) => k !== mySide)!
            const title = c.sideNames[otherKey] || 'Conversation'
            const unread = c.unread?.[mySide] || 0
            const mine = c.lastSenderKey === mySide
            const badge = typeBadge[c.type]
            return (
              <button
                key={c.id}
                onClick={() => router.push(`/chat/${c.id}`)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-full bg-petrol-yellow/15 flex items-center justify-center">
                    <span className="text-petrol-black font-bold text-base">{title.charAt(0).toUpperCase()}</span>
                  </div>
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-petrol-yellow flex items-center justify-center">
                      <span className="text-[10px] font-bold text-petrol-black">{unread > 9 ? '9+' : unread}</span>
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[15px] font-semibold text-petrol-black">{title}</span>
                    <span className="text-[11px] text-gray-400 shrink-0">{timeAgo(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className={`truncate text-[13px] ${unread > 0 ? 'text-petrol-black font-medium' : 'text-gray-500'}`}>
                      {c.lastMessage ? `${mine ? 'You: ' : ''}${c.lastMessage}` : 'No messages yet'}
                    </span>
                    {badge && (
                      <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ChatIcon({ className = '' }: { className?: string }) {
  return (
    <div className={`w-16 h-16 rounded-2xl bg-petrol-yellow/10 flex items-center justify-center ${className}`}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FDB913" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    </div>
  )
}
