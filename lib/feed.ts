/**
 * Petrol Goons Community Feed — Firestore helpers
 *
 * Collection: /posts/{postId}
 * Subcollection: /posts/{postId}/comments/{commentId}
 */

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  startAfter,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  Timestamp,
  QueryDocumentSnapshot,
  DocumentData,
} from 'firebase/firestore'
import { db } from './firebase'

// ==============================
// TYPES
// ==============================

export type PostTag = 'my-build' | 'service-tip' | 'for-sale' | 'event' | 'spotted' | 'question' | 'general'

export const POST_TAG_LABELS: Record<PostTag, string> = {
  'my-build': '🔧 My Build',
  'service-tip': '💡 Service Tip',
  'for-sale': '💰 For Sale',
  'event': '📅 Event',
  'spotted': '📸 Spotted',
  'question': '❓ Question',
  'general': '💬 General',
}

export const POST_TAG_COLORS: Record<PostTag, string> = {
  'my-build': 'bg-petrol-yellow/10 text-petrol-yellow border-petrol-yellow/30',
  'service-tip': 'bg-petrol-green/10 text-petrol-green border-petrol-green/30',
  'for-sale': 'bg-stripe-cyan/10 text-stripe-cyan border-stripe-cyan/30',
  'event': 'bg-purple-500/10 text-purple-400 border-purple-400/30',
  'spotted': 'bg-stripe-red/10 text-red-400 border-red-400/30',
  'question': 'bg-orange-500/10 text-orange-400 border-orange-400/30',
  'general': 'bg-white/5 text-gray-400 border-white/10',
}

export interface Post {
  id?: string
  authorId: string
  authorName: string
  authorPhoto?: string
  content: string
  mediaUrls?: string[]
  tag: PostTag
  likes: string[]           // Array of user UIDs
  commentCount: number
  createdAt: Timestamp | null
  updatedAt: Timestamp | null
}

export interface Comment {
  id?: string
  postId: string
  authorId: string
  authorName: string
  authorPhoto?: string
  content: string
  createdAt: Timestamp | null
}

// ==============================
// POSTS — CREATE
// ==============================

export async function createPost(data: {
  authorId: string
  authorName: string
  authorPhoto?: string
  content: string
  mediaUrls?: string[]
  tag: PostTag
}): Promise<string> {
  const ref = await addDoc(collection(db, 'posts'), {
    authorId: data.authorId,
    authorName: data.authorName,
    authorPhoto: data.authorPhoto || null,
    content: data.content,
    mediaUrls: data.mediaUrls || [],
    tag: data.tag,
    likes: [],
    commentCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

// ==============================
// POSTS — FETCH (paginated)
// ==============================

const PAGE_SIZE = 15

export async function getPosts(cursor?: QueryDocumentSnapshot<DocumentData>): Promise<{
  posts: Post[]
  lastDoc: QueryDocumentSnapshot<DocumentData> | null
}> {
  const postsRef = collection(db, 'posts')
  let q = query(postsRef, orderBy('createdAt', 'desc'), limit(PAGE_SIZE))
  if (cursor) {
    q = query(postsRef, orderBy('createdAt', 'desc'), startAfter(cursor), limit(PAGE_SIZE))
  }

  const snapshot = await getDocs(q)
  const posts: Post[] = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Post))
  const lastDoc = snapshot.docs.length === PAGE_SIZE ? snapshot.docs[snapshot.docs.length - 1] : null
  return { posts, lastDoc }
}

// ==============================
// POSTS — LIKE / UNLIKE
// ==============================

export async function togglePostLike(postId: string, userId: string, isLiked: boolean): Promise<void> {
  const ref = doc(db, 'posts', postId)
  await updateDoc(ref, {
    likes: isLiked ? arrayRemove(userId) : arrayUnion(userId),
    updatedAt: serverTimestamp(),
  })
}

// ==============================
// COMMENTS — CREATE
// ==============================

export async function createComment(data: {
  postId: string
  authorId: string
  authorName: string
  authorPhoto?: string
  content: string
}): Promise<string> {
  // Add comment to subcollection
  const ref = await addDoc(collection(db, 'posts', data.postId, 'comments'), {
    postId: data.postId,
    authorId: data.authorId,
    authorName: data.authorName,
    authorPhoto: data.authorPhoto || null,
    content: data.content,
    createdAt: serverTimestamp(),
  })

  // Increment the post's commentCount
  await updateDoc(doc(db, 'posts', data.postId), {
    commentCount: increment(1),
    updatedAt: serverTimestamp(),
  })

  return ref.id
}

// ==============================
// COMMENTS — FETCH
// ==============================

export async function getComments(postId: string): Promise<Comment[]> {
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(50)
  )
  const snapshot = await getDocs(q)
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Comment))
}

// ==============================
// HELPERS
// ==============================

export function formatTimeAgo(timestamp: Timestamp | null): string {
  if (!timestamp) return 'just now'
  const now = Date.now()
  const then = timestamp.toMillis()
  const diff = Math.floor((now - then) / 1000) // seconds

  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`

  const date = timestamp.toDate()
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}
