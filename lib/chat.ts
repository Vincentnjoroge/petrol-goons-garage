/**
 * Petrol Goons Garage — Chat / Messaging Layer (v2, participant model)
 *
 * Conversations are TOP-LEVEL so they can pair any two parties:
 *   - customer ↔ garage
 *   - customer ↔ specialist (independent mechanic consultancy)
 *   - garage  ↔ specialist
 *
 *   /conversations/{conversationId}
 *   /conversations/{conversationId}/messages/{messageId}
 *
 * A conversation has:
 *   participants: string[]   // individual UIDs (customer and/or specialist)
 *   garageId:     string|null// set when a garage is one side (shared by its staff)
 *   sideKeys:     [k1, k2]   // the two "sides"; a key is a UID or the literal 'garage'
 *   sideNames:    { [k]: name }
 *   unread:       { [k]: number }
 *
 * Access = you are a participant UID, OR you are staff of `garageId`.
 */

import {
  collection,
  addDoc,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  increment,
  Timestamp,
  Unsubscribe,
} from 'firebase/firestore'
import { db } from './firebase'

export type ConversationType = 'customer_garage' | 'customer_specialist' | 'garage_specialist'
export const GARAGE_SIDE = 'garage' as const

export interface Conversation {
  id?: string
  type: ConversationType
  participants: string[]          // UIDs (excludes the garage; garage handled via garageId)
  garageId: string | null
  sideKeys: string[]              // exactly 2
  sideNames: Record<string, string>
  unread: Record<string, number>
  // Optional context
  jobId?: string | null
  bookingTag?: string | null
  // Preview
  lastMessage: string
  lastMessageAt: Timestamp | null
  lastSenderKey: string | null
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface ChatMessage {
  id?: string
  conversationId: string
  senderId: string
  senderName: string
  senderKey: string               // UID or 'garage'
  text: string
  createdAt: Timestamp | null
}

const MAX_MESSAGE_LENGTH = 2000

function conversationsCol() {
  return collection(db, 'conversations')
}
function messagesCol(conversationId: string) {
  return collection(db, 'conversations', conversationId, 'messages')
}

/** Deterministic id per pairing so duplicate threads never form. */
export function buildConversationId(params: {
  type: ConversationType
  customerId?: string
  garageId?: string
  specialistId?: string
  jobId?: string | null
}): string {
  const { type, customerId, garageId, specialistId, jobId } = params
  if (type === 'customer_garage') {
    const base = `cg__${customerId}__${garageId}`
    return jobId ? `${base}__${jobId}` : base
  }
  if (type === 'customer_specialist') {
    return `cs__${customerId}__${specialistId}`
  }
  // garage_specialist
  return `gs__${garageId}__${specialistId}`
}

/**
 * Get or create a conversation for any pairing. Idempotent.
 */
export async function getOrCreateConversation(params: {
  type: ConversationType
  customerId?: string
  customerName?: string
  garageId?: string
  garageName?: string
  specialistId?: string
  specialistName?: string
  jobId?: string | null
  bookingTag?: string | null
}): Promise<string> {
  const conversationId = buildConversationId(params)
  const ref = doc(db, 'conversations', conversationId)
  const snap = await getDoc(ref)
  if (snap.exists()) return conversationId

  let participants: string[] = []
  let garageId: string | null = null
  let sideKeys: string[] = []
  let sideNames: Record<string, string> = {}

  if (params.type === 'customer_garage') {
    participants = [params.customerId!]
    garageId = params.garageId!
    sideKeys = [params.customerId!, GARAGE_SIDE]
    sideNames = { [params.customerId!]: params.customerName || 'Customer', [GARAGE_SIDE]: params.garageName || 'Garage' }
  } else if (params.type === 'customer_specialist') {
    participants = [params.customerId!, params.specialistId!]
    garageId = null
    sideKeys = [params.customerId!, params.specialistId!]
    sideNames = {
      [params.customerId!]: params.customerName || 'Customer',
      [params.specialistId!]: params.specialistName || 'Specialist',
    }
  } else {
    // garage_specialist
    participants = [params.specialistId!]
    garageId = params.garageId!
    sideKeys = [params.specialistId!, GARAGE_SIDE]
    sideNames = { [params.specialistId!]: params.specialistName || 'Specialist', [GARAGE_SIDE]: params.garageName || 'Garage' }
  }

  const convo: Omit<Conversation, 'id'> = {
    type: params.type,
    participants,
    garageId,
    sideKeys,
    sideNames,
    unread: { [sideKeys[0]]: 0, [sideKeys[1]]: 0 },
    jobId: params.jobId ?? null,
    bookingTag: params.bookingTag ?? null,
    lastMessage: '',
    lastMessageAt: null,
    lastSenderKey: null,
    createdAt: serverTimestamp() as unknown as Timestamp,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  }
  await setDoc(ref, convo)
  return conversationId
}

/**
 * Work out which side the current viewer is on.
 * Returns the sideKey ('garage' or a UID) or null if not a member.
 */
export function resolveMySideKey(
  convo: Conversation,
  uid: string,
  myGarageId?: string | null
): string | null {
  if (convo.participants.includes(uid)) return uid
  if (convo.garageId && myGarageId && convo.garageId === myGarageId) return GARAGE_SIDE
  return null
}

export async function sendMessage(params: {
  conversationId: string
  convo: Conversation
  senderId: string
  senderName: string
  mySideKey: string
  text: string
}): Promise<{ success: boolean; error?: string }> {
  const text = params.text.trim()
  if (!text) return { success: false, error: 'Message is empty.' }
  if (text.length > MAX_MESSAGE_LENGTH) return { success: false, error: `Message too long (max ${MAX_MESSAGE_LENGTH}).` }

  try {
    const message: Omit<ChatMessage, 'id'> = {
      conversationId: params.conversationId,
      senderId: params.senderId,
      senderName: params.senderName,
      senderKey: params.mySideKey,
      text,
      createdAt: serverTimestamp() as unknown as Timestamp,
    }
    await addDoc(messagesCol(params.conversationId), message)

    const otherKey = params.convo.sideKeys.find((k) => k !== params.mySideKey)!
    await updateDoc(doc(db, 'conversations', params.conversationId), {
      lastMessage: text.slice(0, 140),
      lastMessageAt: serverTimestamp(),
      lastSenderKey: params.mySideKey,
      updatedAt: serverTimestamp(),
      [`unread.${otherKey}`]: increment(1),
    })
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Failed to send message.' }
  }
}

export async function markConversationRead(conversationId: string, mySideKey: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'conversations', conversationId), {
      [`unread.${mySideKey}`]: 0,
    })
  } catch {
    /* non-fatal */
  }
}

export function subscribeToMessages(
  conversationId: string,
  cb: (messages: ChatMessage[]) => void
): Unsubscribe {
  const q = query(messagesCol(conversationId), orderBy('createdAt', 'asc'), limit(200))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as ChatMessage) })))
  })
}

/** Inbox for a customer or specialist (they appear in `participants`). */
export function subscribeToMyConversations(
  uid: string,
  cb: (conversations: Conversation[]) => void
): Unsubscribe {
  const q = query(
    conversationsCol(),
    where('participants', 'array-contains', uid),
    orderBy('lastMessageAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Conversation) })))
  })
}

/** Inbox for a garage (all threads where this garage is a side). */
export function subscribeToGarageConversations(
  garageId: string,
  cb: (conversations: Conversation[]) => void
): Unsubscribe {
  const q = query(
    conversationsCol(),
    where('garageId', '==', garageId),
    orderBy('lastMessageAt', 'desc')
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Conversation) })))
  })
}

export async function getConversation(conversationId: string): Promise<Conversation | null> {
  const snap = await getDoc(doc(db, 'conversations', conversationId))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Conversation) }
}
