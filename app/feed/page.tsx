'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import {
  createPost,
  getPosts,
  togglePostLike,
  createComment,
  getComments,
  formatTimeAgo,
  getInitials,
  Post,
  Comment,
  PostTag,
  POST_TAG_LABELS,
  POST_TAG_COLORS,
} from '@/lib/feed'
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'

// ==============================
// AVATAR
// ==============================
function Avatar({ name, photoURL, size = 'md' }: { name: string; photoURL?: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-12 h-12 text-base' : 'w-10 h-10 text-sm'
  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt={name}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0 border-2 border-white/10`}
      />
    )
  }
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center flex-shrink-0 font-bold`}
      style={{ background: 'linear-gradient(135deg, #FDB913, #e5a711)', color: '#0A0A0A' }}
    >
      {getInitials(name)}
    </div>
  )
}

// ==============================
// TAG BADGE
// ==============================
function TagBadge({ tag }: { tag: PostTag }) {
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full border ${POST_TAG_COLORS[tag]}`}>
      {POST_TAG_LABELS[tag]}
    </span>
  )
}

// ==============================
// POST COMPOSER
// ==============================
function PostComposer({ user, onPosted }: { user: User; onPosted: (post: Post) => void }) {
  const [content, setContent] = useState('')
  const [tag, setTag] = useState<PostTag>('general')
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [showTagPicker, setShowTagPicker] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).slice(0, 4)
    setImages(files)
    setPreviews(files.map(f => URL.createObjectURL(f)))
  }

  const removeImage = (i: number) => {
    setImages(prev => prev.filter((_, idx) => idx !== i))
    setPreviews(prev => {
      URL.revokeObjectURL(prev[i])
      return prev.filter((_, idx) => idx !== i)
    })
  }

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return
    setSubmitting(true)
    try {
      const { storage } = await import('@/lib/firebase')
      const mediaUrls: string[] = []

      for (const file of images) {
        const path = `feed/${user.uid}/${Date.now()}_${file.name}`
        const snap = await uploadBytes(storageRef(storage, path), file)
        const url = await getDownloadURL(snap.ref)
        mediaUrls.push(url)
      }

      const postId = await createPost({
        authorId: user.uid,
        authorName: user.displayName || user.phoneNumber || 'Goon',
        authorPhoto: user.photoURL || undefined,
        content: content.trim(),
        mediaUrls,
        tag,
      })

      onPosted({
        id: postId,
        authorId: user.uid,
        authorName: user.displayName || user.phoneNumber || 'Goon',
        authorPhoto: user.photoURL || undefined,
        content: content.trim(),
        mediaUrls,
        tag,
        likes: [],
        commentCount: 0,
        createdAt: null,
        updatedAt: null,
      })

      setContent('')
      setTag('general')
      setImages([])
      setPreviews([])
    } catch (err) {
      console.error('Post failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 mb-4">
      <div className="flex items-start space-x-3">
        <Avatar name={user.displayName || 'G'} photoURL={user.photoURL || undefined} />
        <div className="flex-1 min-w-0">
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder="What's happening in your garage? Share a build, tip, or spotted car..."
            rows={3}
            maxLength={500}
            className="w-full bg-transparent text-white placeholder-gray-600 resize-none text-sm leading-relaxed focus:outline-none"
          />

          {/* Image previews */}
          {previews.length > 0 && (
            <div className={`grid gap-2 mt-2 ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {previews.map((src, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden aspect-video bg-black">
                  <img src={src} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(i)}
                    className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center hover:bg-black transition-all"
                  >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Toolbar */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
            <div className="flex items-center space-x-2">
              {/* Image upload */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 4}
                className="flex items-center space-x-1.5 text-gray-500 hover:text-petrol-green transition-colors text-xs disabled:opacity-30 p-1.5"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Photo</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImageSelect}
              />

              {/* Tag picker */}
              <div className="relative">
                <button
                  onClick={() => setShowTagPicker(!showTagPicker)}
                  className="flex items-center space-x-1.5 text-gray-500 hover:text-petrol-yellow transition-colors text-xs p-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a2 2 0 012-2z" />
                  </svg>
                  <span>{POST_TAG_LABELS[tag]}</span>
                </button>
                {showTagPicker && (
                  <div className="absolute left-0 bottom-8 bg-[#1a1a1a] border border-white/10 rounded-xl p-2 z-20 min-w-[160px] shadow-xl">
                    {(Object.keys(POST_TAG_LABELS) as PostTag[]).map(t => (
                      <button
                        key={t}
                        onClick={() => { setTag(t); setShowTagPicker(false) }}
                        className={`w-full text-left text-xs px-3 py-2 rounded-lg transition-all ${tag === t ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5'}`}
                      >
                        {POST_TAG_LABELS[t]}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className={`text-xs ${content.length > 450 ? 'text-petrol-yellow' : 'text-gray-600'}`}>
                {content.length}/500
              </span>
              <button
                onClick={handleSubmit}
                disabled={!content.trim() || submitting}
                className="bg-petrol-green text-petrol-black font-bold text-sm px-4 py-2 rounded-lg hover:brightness-110 transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <span className="flex items-center space-x-1.5">
                    <div className="w-3.5 h-3.5 border-2 border-petrol-black/40 border-t-petrol-black rounded-full animate-spin" />
                    <span>Posting...</span>
                  </span>
                ) : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==============================
// COMMENT INPUT
// ==============================
function CommentInput({ user, postId, onCommented }: { user: User; postId: string; onCommented: (c: Comment) => void }) {
  const [text, setText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!text.trim() || submitting) return
    setSubmitting(true)
    try {
      const commentId = await createComment({
        postId,
        authorId: user.uid,
        authorName: user.displayName || user.phoneNumber || 'Goon',
        authorPhoto: user.photoURL || undefined,
        content: text.trim(),
      })
      onCommented({
        id: commentId,
        postId,
        authorId: user.uid,
        authorName: user.displayName || user.phoneNumber || 'Goon',
        authorPhoto: user.photoURL || undefined,
        content: text.trim(),
        createdAt: null,
      })
      setText('')
    } catch (err) {
      console.error('Comment failed:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex items-center space-x-2 mt-3 pt-3 border-t border-white/5">
      <Avatar name={user.displayName || 'G'} photoURL={user.photoURL || undefined} size="sm" />
      <div className="flex-1 flex items-center space-x-2 bg-white/[0.04] rounded-full px-4 py-2 border border-white/10">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
          placeholder="Write a comment..."
          maxLength={300}
          className="flex-1 bg-transparent text-white text-sm placeholder-gray-600 focus:outline-none min-w-0"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim() || submitting}
          className="text-petrol-green disabled:text-gray-600 transition-colors flex-shrink-0"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-petrol-green/30 border-t-petrol-green rounded-full animate-spin" />
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}

// ==============================
// POST CARD
// ==============================
function PostCard({ post, currentUser, onLike }: {
  post: Post
  currentUser: User | null
  onLike: (postId: string) => void
}) {
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [lightboxImg, setLightboxImg] = useState<string | null>(null)

  const isLiked = currentUser ? post.likes.includes(currentUser.uid) : false

  const handleShowComments = async () => {
    if (!showComments && comments.length === 0 && post.commentCount > 0) {
      setLoadingComments(true)
      try {
        const fetched = await getComments(post.id!)
        setComments(fetched)
      } catch (err) {
        console.error('Failed to load comments:', err)
      } finally {
        setLoadingComments(false)
      }
    }
    setShowComments(prev => !prev)
  }

  const handleCommented = (c: Comment) => {
    setComments(prev => [...prev, c])
    setShowComments(true)
  }

  return (
    <article className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 mb-3">
      {/* Author row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2.5 min-w-0">
          <Avatar
            name={post.authorName}
            photoURL={post.authorPhoto}
            size="md"
          />
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm truncate">{post.authorName}</p>
            <p className="text-gray-600 text-xs">{formatTimeAgo(post.createdAt)}</p>
          </div>
        </div>
        <TagBadge tag={post.tag} />
      </div>

      {/* Content */}
      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap mb-3">
        {post.content}
      </p>

      {/* Images */}
      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className={`grid gap-1.5 mb-3 rounded-xl overflow-hidden ${
          post.mediaUrls.length === 1 ? 'grid-cols-1' :
          post.mediaUrls.length === 2 ? 'grid-cols-2' :
          post.mediaUrls.length === 3 ? 'grid-cols-3' :
          'grid-cols-2'
        }`}>
          {post.mediaUrls.map((url, i) => (
            <button
              key={i}
              onClick={() => setLightboxImg(url)}
              className={`relative overflow-hidden bg-black ${
                post.mediaUrls!.length === 1 ? 'aspect-video' :
                post.mediaUrls!.length === 3 && i === 0 ? 'row-span-2 aspect-square' : 'aspect-square'
              }`}
            >
              <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
              {/* 4+ overlay */}
              {post.mediaUrls!.length > 4 && i === 3 && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="text-white font-bold text-xl">+{post.mediaUrls!.length - 4}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-4">
        {/* Like */}
        <button
          onClick={() => currentUser && onLike(post.id!)}
          className={`flex items-center space-x-1.5 transition-all text-sm font-medium ${
            isLiked ? 'text-petrol-yellow' : 'text-gray-500 hover:text-petrol-yellow'
          } ${!currentUser ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <svg
            className="w-4.5 h-4.5"
            style={{ width: '18px', height: '18px' }}
            fill={isLiked ? 'currentColor' : 'none'}
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
          <span>{post.likes.length || ''}</span>
        </button>

        {/* Comment */}
        <button
          onClick={handleShowComments}
          className="flex items-center space-x-1.5 text-gray-500 hover:text-stripe-cyan transition-colors text-sm font-medium"
        >
          <svg className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>{post.commentCount > 0 ? post.commentCount : ''}</span>
        </button>

        {/* Share */}
        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ text: post.content, url: window.location.href })
            }
          }}
          className="flex items-center space-x-1.5 text-gray-500 hover:text-petrol-green transition-colors text-sm font-medium ml-auto"
        >
          <svg className="w-4.5 h-4.5" style={{ width: '18px', height: '18px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="mt-3">
          {loadingComments ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-petrol-green/30 border-t-petrol-green rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-3 mb-2">
              {comments.map(c => (
                <div key={c.id} className="flex items-start space-x-2.5">
                  <Avatar name={c.authorName} photoURL={c.authorPhoto} size="sm" />
                  <div className="flex-1 bg-white/[0.04] rounded-xl px-3 py-2 min-w-0">
                    <p className="text-white text-xs font-semibold mb-0.5">{c.authorName}</p>
                    <p className="text-gray-400 text-xs leading-relaxed">{c.content}</p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && post.commentCount === 0 && (
                <p className="text-gray-600 text-xs text-center py-2">No comments yet. Be first!</p>
              )}
            </div>
          )}

          {currentUser ? (
            <CommentInput
              user={currentUser}
              postId={post.id!}
              onCommented={handleCommented}
            />
          ) : (
            <p className="text-gray-600 text-xs text-center pt-3 border-t border-white/5">
              <a href="/" className="text-petrol-green hover:underline">Sign in</a> to comment
            </p>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxImg && (
        <div
          className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImg(null)}
        >
          <img src={lightboxImg} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition-all"
            onClick={() => setLightboxImg(null)}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </article>
  )
}

// ==============================
// MAIN PAGE
// ==============================
export default function FeedPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [activeTag, setActiveTag] = useState<PostTag | 'all'>('all')

  // Auth
  useEffect(() => {
    let cancelled = false
    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        const unsub = auth.onAuthStateChanged((u) => {
          if (!cancelled) {
            setCurrentUser(u)
            setCheckingAuth(false)
          }
        })
        return unsub
      } catch {
        if (!cancelled) setCheckingAuth(false)
      }
    }
    const unsubPromise = init()
    return () => {
      cancelled = true
      unsubPromise.then(unsub => unsub?.())
    }
  }, [])

  // Initial load
  useEffect(() => {
    loadPosts()
  }, [])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const { posts: fetched, lastDoc } = await getPosts()
      setPosts(fetched)
      setCursor(lastDoc)
      setHasMore(!!lastDoc)
    } catch (err) {
      console.error('Failed to load posts:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async () => {
    if (loadingMore || !hasMore || !cursor) return
    setLoadingMore(true)
    try {
      const { posts: more, lastDoc } = await getPosts(cursor)
      setPosts(prev => [...prev, ...more])
      setCursor(lastDoc)
      setHasMore(!!lastDoc)
    } catch (err) {
      console.error('Failed to load more:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const handlePosted = (post: Post) => {
    setPosts(prev => [post, ...prev])
  }

  const handleLike = async (postId: string) => {
    if (!currentUser) return
    const post = posts.find(p => p.id === postId)
    if (!post) return
    const isLiked = post.likes.includes(currentUser.uid)
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? {
            ...p,
            likes: isLiked
              ? p.likes.filter(uid => uid !== currentUser.uid)
              : [...p.likes, currentUser.uid],
          }
        : p
    ))
    try {
      await togglePostLike(postId, currentUser.uid, isLiked)
    } catch {
      // Revert on failure
      setPosts(prev => prev.map(p =>
        p.id === postId
          ? {
              ...p,
              likes: isLiked
                ? [...p.likes, currentUser.uid]
                : p.likes.filter(uid => uid !== currentUser.uid),
            }
          : p
      ))
    }
  }

  const filteredPosts = activeTag === 'all' ? posts : posts.filter(p => p.tag === activeTag)

  // Loading splash
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-petrol-black flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-petrol-green border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-petrol-black">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-petrol-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => window.location.href = '/'}
              className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-white font-bold text-base leading-tight">
                <span className="text-petrol-green">PETROL</span>{' '}
                <span className="text-petrol-yellow">GOONS</span>
              </h1>
              <p className="text-gray-600 text-xs">Community Feed</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {currentUser ? (
              <Avatar name={currentUser.displayName || 'G'} photoURL={currentUser.photoURL || undefined} size="sm" />
            ) : (
              <a
                href="/"
                className="text-xs font-semibold text-petrol-green border border-petrol-green/30 px-3 py-1.5 rounded-lg hover:bg-petrol-green/10 transition-all"
              >
                Sign In
              </a>
            )}
          </div>
        </div>

        {/* Tag filter strip */}
        <div className="max-w-lg mx-auto px-4 pb-3">
          <div className="flex space-x-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTag('all')}
              className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                activeTag === 'all'
                  ? 'bg-white/10 text-white border-white/20'
                  : 'text-gray-500 border-white/5 hover:border-white/15'
              }`}
            >
              🏎️ All
            </button>
            {(Object.keys(POST_TAG_LABELS) as PostTag[]).map(t => (
              <button
                key={t}
                onClick={() => setActiveTag(t)}
                className={`flex-shrink-0 text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  activeTag === t
                    ? `${POST_TAG_COLORS[t]} border-current`
                    : 'text-gray-500 border-white/5 hover:border-white/15'
                }`}
              >
                {POST_TAG_LABELS[t]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="max-w-lg mx-auto px-4 pt-4 pb-24">

        {/* Composer */}
        {currentUser ? (
          <PostComposer user={currentUser} onPosted={handlePosted} />
        ) : (
          <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-5 mb-4 text-center">
            <p className="text-gray-400 text-sm mb-3">
              Join the Petrol Goons community — share builds, tips, and spotted cars
            </p>
            <a
              href="/"
              className="inline-block bg-petrol-green text-petrol-black font-bold text-sm px-6 py-2.5 rounded-xl hover:brightness-110 transition-all active:scale-95"
            >
              Sign in to Post
            </a>
          </div>
        )}

        {/* Posts */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white/[0.04] rounded-2xl p-4 animate-pulse">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-white/5" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-white/5 rounded w-1/3" />
                    <div className="h-2 bg-white/5 rounded w-1/4" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-3 bg-white/5 rounded" />
                  <div className="h-3 bg-white/5 rounded w-4/5" />
                  <div className="h-3 bg-white/5 rounded w-3/5" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🏎️</div>
            <p className="text-white font-semibold text-lg mb-2">
              {activeTag === 'all' ? 'No posts yet' : `No ${POST_TAG_LABELS[activeTag as PostTag]} posts yet`}
            </p>
            <p className="text-gray-500 text-sm">
              {currentUser ? 'Be the first to post something!' : 'Sign in to be first to post!'}
            </p>
          </div>
        ) : (
          <>
            {filteredPosts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                currentUser={currentUser}
                onLike={handleLike}
              />
            ))}

            {/* Load more */}
            {hasMore && activeTag === 'all' && (
              <div className="flex justify-center pt-4">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="flex items-center space-x-2 text-sm text-gray-500 hover:text-white transition-colors border border-white/10 px-5 py-2.5 rounded-xl hover:border-white/20"
                >
                  {loadingMore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load more posts</span>
                  )}
                </button>
              </div>
            )}

            {!hasMore && filteredPosts.length > 0 && (
              <p className="text-center text-gray-700 text-xs pt-6 pb-4">You&apos;re all caught up 🏁</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
