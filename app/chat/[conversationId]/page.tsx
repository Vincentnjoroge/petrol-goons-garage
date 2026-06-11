'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { onAuthStateChanged, User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import {
  ChatMessage,
  Conversation,
  resolveMySideKey,
  subscribeToMessages,
  sendMessage,
  markConversationRead,
  getConversation,
} from '@/lib/chat'
import type { UserProfile } from '@/lib/types'

function formatTime(ts: any): string {
  if (!ts?.toDate) return ''
  return (ts.toDate() as Date).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' })
}
function dateLabel(ts: any): string {
  if (!ts?.toDate) return ''
  const d = ts.toDate() as Date
  const today = new Date(); const yest = new Date(); yest.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yest.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ChatThreadPage() {
  const router = useRouter()
  const params = useParams()
  const conversationId = String(params?.conversationId || '')

  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [convo, setConvo] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)

  const mySideKey = convo && user ? resolveMySideKey(convo, user.uid, profile?.garageId) : null

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (u) {
        const snap = await getDoc(doc(db, 'users', u.uid))
        setProfile(snap.exists() ? ({ id: snap.id, ...snap.data() } as UserProfile) : null)
      } else {
        router.replace('/')
      }
    })
    return () => unsub()
  }, [router])

  useEffect(() => {
    if (!conversationId) return
    getConversation(conversationId).then(setConvo)
  }, [conversationId])

  useEffect(() => {
    if (!conversationId || !user) return
    const unsub = subscribeToMessages(conversationId, (m) => { setMessages(m); setLoading(false) })
    return () => unsub()
  }, [conversationId, user])

  useEffect(() => {
    if (!conversationId || !mySideKey) return
    markConversationRead(conversationId, mySideKey)
  }, [conversationId, mySideKey, messages.length])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages.length])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !user || !convo || !mySideKey || sending) return
    setSending(true)
    setInput('')
    const res = await sendMessage({
      conversationId,
      convo,
      senderId: user.uid,
      senderName: profile?.displayName || user.displayName || 'You',
      mySideKey,
      text,
    })
    if (!res.success) setInput(text)
    setSending(false)
  }, [input, user, convo, mySideKey, profile, conversationId, sending])

  const otherKey = convo && mySideKey ? convo.sideKeys.find((k) => k !== mySideKey) : null
  const title = convo && otherKey ? convo.sideNames[otherKey] : 'Conversation'
  const subtitle = convo?.bookingTag ? `Booking ${convo.bookingTag}`
    : convo?.type === 'customer_specialist' || convo?.type === 'garage_specialist' ? 'Specialist consult'
    : convo?.type === 'customer_garage' ? 'Garage' : ''

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-[430px] mx-auto">
      <div className="shrink-0 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 px-3 pt-3 pb-3">
          <button onClick={() => router.push('/chat')} className="text-petrol-black p-1">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="w-9 h-9 rounded-full bg-petrol-yellow/15 flex items-center justify-center shrink-0">
            <span className="text-petrol-black font-bold text-sm">{(title || '?').charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold text-petrol-black truncate">{title || 'Conversation'}</p>
            <p className="text-[11px] text-gray-400 truncate">{subtitle}</p>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {loading ? (
          <div className="flex justify-center py-10"><div className="w-7 h-7 border-2 border-petrol-yellow border-t-transparent rounded-full animate-spin" /></div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-petrol-yellow/10 flex items-center justify-center mb-3">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FDB913" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
            </div>
            <p className="text-sm font-semibold text-petrol-black">Start the conversation</p>
          </div>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderKey === mySideKey
            const showDate = i === 0 || dateLabel(messages[i - 1].createdAt) !== dateLabel(m.createdAt)
            const showSender = !mine && (mySideKey === 'garage' || convo?.type !== 'customer_specialist')
            return (
              <div key={m.id || i}>
                {showDate && (
                  <div className="flex justify-center my-3">
                    <span className="text-[11px] text-gray-400 bg-gray-100 px-3 py-1 rounded-full">{dateLabel(m.createdAt)}</span>
                  </div>
                )}
                <div className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[78%] px-3.5 py-2 rounded-2xl ${mine ? 'bg-petrol-yellow text-petrol-black rounded-br-md' : 'bg-white text-petrol-black rounded-bl-md border border-gray-100'}`}>
                    {showSender && <p className="text-[11px] font-semibold text-gray-400 mb-0.5">{m.senderName}</p>}
                    <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{m.text}</p>
                    <p className={`text-[10px] mt-0.5 text-right ${mine ? 'text-petrol-black/50' : 'text-gray-400'}`}>{formatTime(m.createdAt)}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {mySideKey ? (
        <div className="shrink-0 bg-white border-t border-gray-100 px-3 py-2.5 safe-area-bottom">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Type a message..."
              rows={1}
              className="flex-1 resize-none max-h-28 bg-gray-100 rounded-2xl px-4 py-2.5 text-[14px] text-petrol-black placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-petrol-yellow/40"
            />
            <button onClick={handleSend} disabled={!input.trim() || sending}
              className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-all ${input.trim() && !sending ? 'bg-petrol-yellow active:scale-95' : 'bg-gray-200'}`}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={input.trim() ? '#0A0A0A' : '#9CA3AF'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 bg-white border-t border-gray-100 px-4 py-3 text-center">
          <p className="text-sm text-gray-400">You don't have access to this conversation.</p>
        </div>
      )}
    </div>
  )
}
