'use client'

import { useState, useEffect } from 'react'
import { onAuthStateChanged, signOut, User } from 'firebase/auth'
import { getAllGarages, updateGarageProfile, getUserProfile } from '@/lib/garages'
import { sendBookingEmail, getNewGarageApplicationEmailHtml } from '@/lib/email'
import { isSuperAdmin } from '@/lib/roles'
import { Garage, UserProfile, SUBSCRIPTION_PLANS, SubscriptionPlan } from '@/lib/types'

type AdminTab = 'garages' | 'analytics' | 'billing'

export default function SuperAdminPage() {
  const [user, setUser] = useState<User | null>(null)
  const [pageReady, setPageReady] = useState(false)
  const [notAuthorized, setNotAuthorized] = useState(false)

  const [garages, setGarages] = useState<Garage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<AdminTab>('garages')
  const [garageFilter, setGarageFilter] = useState<string>('all')
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    const timeout = setTimeout(() => { if (!pageReady) window.location.href = '/' }, 6000)

    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase')
        unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
          clearTimeout(timeout)
          if (!currentUser) { window.location.href = '/'; return }
          if (!isSuperAdmin(currentUser.email)) {
            setNotAuthorized(true)
            setPageReady(true)
            return
          }
          setUser(currentUser)
          setPageReady(true)
        })
      } catch {
        clearTimeout(timeout)
        window.location.href = '/'
      }
    }
    init()
    return () => { clearTimeout(timeout); unsubscribe?.() }
  }, [pageReady])

  useEffect(() => {
    if (pageReady && user) loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageReady, user])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getAllGarages()
      setGarages(data)
    } catch (err: any) {
      setError('Failed to load garages')
    }
    setLoading(false)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleGarageStatus = async (garage: Garage, newStatus: 'approved' | 'suspended') => {
    if (!garage.id) return
    setActionLoading(garage.id)
    try {
      await updateGarageProfile(garage.id, { status: newStatus })
      setGarages(prev => prev.map(g => g.id === garage.id ? { ...g, status: newStatus } : g))

      // Send approval email
      if (newStatus === 'approved' && garage.ownerEmail) {
        try {
          await sendBookingEmail(
            garage.ownerEmail,
            `Welcome to Petrol Goons — ${garage.name} is Approved!`,
            `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#0A0A0A;padding:30px;text-align:center;">
                <span style="color:#FDB913;font-size:24px;font-weight:bold;">PETROL GOONS</span>
              </div>
              <div style="padding:30px;background:white;border:1px solid #e5e7eb;">
                <h2 style="color:#059669;">✓ Your Garage is Approved!</h2>
                <p>Hi ${garage.ownerName},</p>
                <p>Great news — <strong>${garage.name}</strong> has been approved and is now part of the Petrol Goons network!</p>
                <p>What happens next:</p>
                <ul>
                  <li>Log into your garage dashboard</li>
                  <li>Add your team members</li>
                  <li>Start receiving bookings</li>
                </ul>
                <p>Welcome aboard! 🏁<br><strong>The Petrol Goons Team</strong></p>
              </div>
            </div>`
          )
        } catch { /* email failed silently */ }
      }
    } catch (err) {
      setError('Failed to update garage status')
    }
    setActionLoading(null)
  }

  const handlePlanChange = async (garage: Garage, newPlan: SubscriptionPlan) => {
    if (!garage.id) return
    setActionLoading(garage.id)
    try {
      const planConfig = SUBSCRIPTION_PLANS[newPlan]
      await updateGarageProfile(garage.id, {
        subscriptionPlan: newPlan,
        planLimits: planConfig.limits,
      })
      setGarages(prev => prev.map(g =>
        g.id === garage.id ? { ...g, subscriptionPlan: newPlan, planLimits: planConfig.limits } : g
      ))
    } catch {
      setError('Failed to update plan')
    }
    setActionLoading(null)
  }

  const handleSignOut = async () => {
    try {
      const { auth: firebaseAuth } = await import('@/lib/firebase')
      await signOut(firebaseAuth)
    } catch {}
    window.location.href = '/'
  }

  // Filter garages
  const filteredGarages = garages.filter(g => {
    if (garageFilter === 'all') return true
    return g.status === garageFilter
  })

  const pendingCount = garages.filter(g => g.status === 'pending').length
  const approvedCount = garages.filter(g => ['approved', 'active'].includes(g.status)).length
  const suspendedCount = garages.filter(g => g.status === 'suspended').length

  if (!pageReady) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading admin...</p>
        </div>
      </div>
    )
  }

  if (notAuthorized) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 bg-red-500 bg-opacity-20 rounded-full flex items-center justify-center">
            <span className="text-3xl">🔒</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Super Admin Only</h1>
          <p className="text-gray-400 mb-6">This area is restricted to the Petrol Goons platform team.</p>
          <button onClick={handleSignOut} className="w-full bg-petrol-yellow text-black font-bold py-3 rounded-xl">Sign Out</button>
        </div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-petrol-black text-white p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="brand-text text-lg">
                <span className="text-petrol-green">PETROL</span>
                <span className="inline-block bg-petrol-yellow text-petrol-black px-1.5 py-0 ml-0.5 -skew-x-6 text-base">GOONS</span>
              </span>
              <span className="text-red-400 text-xs font-bold bg-red-400 bg-opacity-20 px-2 py-0.5 rounded">SUPER ADMIN</span>
            </div>
            <p className="text-gray-400 text-xs mt-0.5">Platform Management</p>
          </div>
          <div className="flex items-center space-x-2">
            <button onClick={() => window.location.href = '/'} className="bg-white bg-opacity-10 text-white px-3 py-2 rounded-lg text-sm hover:bg-opacity-20" title="Home">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
            </button>
            <button onClick={() => window.location.href = '/dashboard'} className="bg-white bg-opacity-10 text-white px-3 py-2 rounded-lg text-sm hover:bg-opacity-20" title="Legacy Dashboard">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
            </button>
            <button onClick={handleRefresh} disabled={refreshing}
              className="bg-white bg-opacity-10 text-white px-3 py-2 rounded-lg text-sm hover:bg-opacity-20 disabled:opacity-50">
              <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            <button onClick={handleSignOut} className="bg-petrol-yellow text-black px-4 py-2 rounded-lg font-medium text-sm">
              Sign Out
            </button>
          </div>
        </div>
      </div>
      <div className="racing-stripe"></div>

      <div className="max-w-6xl mx-auto p-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-gray-800">{garages.length}</p>
            <p className="text-xs text-gray-500">Total Garages</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-green-600">{approvedCount}</p>
            <p className="text-xs text-gray-500">Active</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{suspendedCount}</p>
            <p className="text-xs text-gray-500">Suspended</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-white rounded-xl p-1 shadow-sm mb-5">
          {([
            { key: 'garages' as AdminTab, label: `🏪 Garages (${garages.length})` },
            { key: 'analytics' as AdminTab, label: '📊 Platform Analytics' },
            { key: 'billing' as AdminTab, label: '💳 Billing' },
          ]).map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all whitespace-nowrap px-3 ${
                activeTab === tab.key ? 'bg-petrol-black text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {tab.label}
              {tab.key === 'garages' && pendingCount > 0 && (
                <span className="ml-1.5 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full inline-flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
            <p>{error}</p>
            <button onClick={() => setError(null)} className="text-red-500 underline text-sm">Dismiss</button>
          </div>
        )}

        {/* ===== GARAGES TAB ===== */}
        {activeTab === 'garages' && (
          <div>
            {/* Filter */}
            <div className="flex space-x-2 mb-4 overflow-x-auto">
              {([
                { key: 'all', label: 'All', count: garages.length },
                { key: 'pending', label: 'Pending', count: pendingCount },
                { key: 'approved', label: 'Active', count: approvedCount },
                { key: 'suspended', label: 'Suspended', count: suspendedCount },
              ]).map(f => (
                <button key={f.key} onClick={() => setGarageFilter(f.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
                    garageFilter === f.key ? 'bg-petrol-black text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                  }`}>
                  {f.label} ({f.count})
                </button>
              ))}
            </div>

            {loading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
              </div>
            ) : filteredGarages.length === 0 ? (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                <p>No garages found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredGarages.map(garage => (
                  <div key={garage.id} className={`bg-white rounded-lg shadow p-5 ${garage.status === 'suspended' ? 'opacity-60' : ''}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-3 flex-wrap gap-y-1">
                          <h3 className="text-lg font-bold">{garage.name}</h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            garage.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            ['approved', 'active'].includes(garage.status) ? 'bg-green-100 text-green-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {garage.status === 'pending' ? '⏳ PENDING' :
                             ['approved', 'active'].includes(garage.status) ? '✓ ACTIVE' :
                             'SUSPENDED'}
                          </span>
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                            {garage.subscriptionPlan || 'basic'} plan
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <p className="text-gray-400 text-xs">Owner</p>
                            <p className="font-medium">{garage.ownerName}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Phone</p>
                            <p className="font-medium">{garage.ownerPhone}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Email</p>
                            <p className="font-medium truncate">{garage.ownerEmail}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Location</p>
                            <p className="font-medium">{garage.location}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Team Size</p>
                            <p className="font-medium">{garage.mechanicCount} mechanics</p>
                          </div>
                          <div>
                            <p className="text-gray-400 text-xs">Country</p>
                            <p className="font-medium">{garage.country || 'KE'} · {garage.currency || 'KES'}</p>
                          </div>
                        </div>

                        {garage.servicesOffered && garage.servicesOffered.length > 0 && (
                          <div className="mt-3">
                            <p className="text-gray-400 text-xs mb-1">Services</p>
                            <div className="flex flex-wrap gap-1">
                              {garage.servicesOffered.map(s => (
                                <span key={s} className="bg-yellow-50 text-yellow-800 text-xs px-2 py-0.5 rounded">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        <p className="text-gray-300 text-xs mt-3">
                          Applied: {garage.createdAt?.toDate?.()
                            ? garage.createdAt.toDate().toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Just now'}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col space-y-2 ml-4 shrink-0">
                        {garage.status === 'pending' && (
                          <>
                            <button onClick={() => handleGarageStatus(garage, 'approved')}
                              disabled={actionLoading === garage.id}
                              className="px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
                              {actionLoading === garage.id ? '...' : '✓ Approve'}
                            </button>
                            <button onClick={() => handleGarageStatus(garage, 'suspended')}
                              disabled={actionLoading === garage.id}
                              className="px-4 py-2.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50">
                              Decline
                            </button>
                          </>
                        )}
                        {['approved', 'active'].includes(garage.status) && (
                          <button onClick={() => handleGarageStatus(garage, 'suspended')}
                            disabled={actionLoading === garage.id}
                            className="px-4 py-2.5 bg-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-300 disabled:opacity-50">
                            Suspend
                          </button>
                        )}
                        {garage.status === 'suspended' && (
                          <button onClick={() => handleGarageStatus(garage, 'approved')}
                            disabled={actionLoading === garage.id}
                            className="px-4 py-2.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50">
                            Reactivate
                          </button>
                        )}

                        {/* Plan selector */}
                        {['approved', 'active'].includes(garage.status) && (
                          <select value={garage.subscriptionPlan || 'basic'}
                            onChange={e => handlePlanChange(garage, e.target.value as SubscriptionPlan)}
                            disabled={actionLoading === garage.id}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-xs bg-white">
                            <option value="basic">Basic</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                          </select>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== ANALYTICS TAB ===== */}
        {activeTab === 'analytics' && (
          <div>
            <h2 className="text-lg font-bold mb-4">Platform Analytics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Garages by Plan</h3>
                {(['basic', 'pro', 'enterprise'] as SubscriptionPlan[]).map(plan => {
                  const count = garages.filter(g => (g.subscriptionPlan || 'basic') === plan).length
                  return (
                    <div key={plan} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="font-medium capitalize">{SUBSCRIPTION_PLANS[plan].name}</span>
                      <span className="text-sm bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full font-semibold">{count}</span>
                    </div>
                  )
                })}
              </div>

              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Garages by Country</h3>
                {(() => {
                  const countries: Record<string, number> = {}
                  garages.forEach(g => { countries[g.country || 'KE'] = (countries[g.country || 'KE'] || 0) + 1 })
                  return Object.entries(countries).sort((a, b) => b[1] - a[1]).map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="font-medium">{country}</span>
                      <span className="text-sm bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-semibold">{count}</span>
                    </div>
                  ))
                })()}
                {garages.length === 0 && <p className="text-gray-400 text-sm">No data yet</p>}
              </div>

              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Monthly Revenue Potential</h3>
                {(() => {
                  let total = 0
                  garages.filter(g => ['approved', 'active'].includes(g.status)).forEach(g => {
                    const plan = (g.subscriptionPlan || 'basic') as SubscriptionPlan
                    total += SUBSCRIPTION_PLANS[plan].price
                  })
                  return (
                    <div className="text-center">
                      <p className="text-4xl font-bold text-petrol-yellow">KES {total.toLocaleString()}</p>
                      <p className="text-sm text-gray-500 mt-1">if all active garages paid</p>
                    </div>
                  )
                })()}
              </div>

              <div className="bg-white rounded-lg shadow p-5">
                <h3 className="font-semibold text-gray-700 mb-3">Growth</h3>
                <div className="text-center">
                  <p className="text-4xl font-bold text-green-600">{garages.length}</p>
                  <p className="text-sm text-gray-500 mt-1">garages signed up</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== BILLING TAB ===== */}
        {activeTab === 'billing' && (
          <div>
            <h2 className="text-lg font-bold mb-4">SaaS Billing</h2>
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
              <span className="text-4xl mb-4 block">🏗️</span>
              <p className="text-lg font-medium">Billing module coming soon</p>
              <p className="text-sm mt-2">Invoice generation, payment tracking, and revenue reports will be here.</p>
              <p className="text-xs text-gray-400 mt-4">For now, garages are tagged with plans but nothing is gated.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
