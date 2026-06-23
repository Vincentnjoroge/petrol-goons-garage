'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import BottomNav from '../components/BottomNav'

interface Listing {
  id: string
  name: string
  price: number
  year: number
  mileage: string
  fuel: string
  location: string
  badge: 'verified' | 'flash' | 'premium' | null
  badgeExtra: 'verified' | 'premium' | null
  image: string
}

const LISTINGS: Listing[] = [
  {
    id: '1',
    name: 'Subaru WRX STI',
    price: 4200000,
    year: 2020,
    mileage: '22,000 km',
    fuel: 'Petrol',
    location: 'Nakuru, Kenya',
    badge: 'verified',
    badgeExtra: null,
    image: 'https://images.unsplash.com/photo-1580274455191-1c62238ce452?w=600&h=360&fit=crop',
  },
  {
    id: '2',
    name: 'BMW M3 Competition',
    price: 9800000,
    year: 2023,
    mileage: '5,000 km',
    fuel: 'Petrol',
    location: 'Nairobi, Kenya',
    badge: 'flash',
    badgeExtra: 'premium',
    image: 'https://images.unsplash.com/photo-1617814076367-b759c7d7e738?w=600&h=360&fit=crop',
  },
  {
    id: '3',
    name: 'Mercedes-AMG G63',
    price: 18500000,
    year: 2023,
    mileage: '3,200 km',
    fuel: 'Petrol',
    location: 'Nairobi, Kenya',
    badge: 'premium',
    badgeExtra: null,
    image: 'https://images.unsplash.com/photo-1520031441872-265e4ff70366?w=600&h=360&fit=crop',
  },
  {
    id: '4',
    name: 'Mazda RX-7 FD',
    price: 6500000,
    year: 1993,
    mileage: '45,000 km',
    fuel: 'Petrol',
    location: 'Kisumu, Kenya',
    badge: 'verified',
    badgeExtra: null,
    image: 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600&h=360&fit=crop',
  },
  {
    id: '5',
    name: 'Toyota Land Cruiser V8',
    price: 8500000,
    year: 2022,
    mileage: '15,000 km',
    fuel: 'Diesel',
    location: 'Nairobi, Kenya',
    badge: 'flash',
    badgeExtra: 'verified',
    image: 'https://images.unsplash.com/photo-1594611396850-fa2c63d59e81?w=600&h=360&fit=crop',
  },
  {
    id: '6',
    name: 'Nissan Skyline GT-R R34',
    price: 12000000,
    year: 1999,
    mileage: '68,000 km',
    fuel: 'Petrol',
    location: 'Mombasa, Kenya',
    badge: 'premium',
    badgeExtra: null,
    image: 'https://images.unsplash.com/photo-1611016186353-652e59ef3099?w=600&h=360&fit=crop',
  },
  {
    id: '7',
    name: 'Porsche 911 Carrera',
    price: 14500000,
    year: 2021,
    mileage: '8,500 km',
    fuel: 'Petrol',
    location: 'Nairobi, Kenya',
    badge: 'verified',
    badgeExtra: 'premium',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&h=360&fit=crop',
  },
  {
    id: '8',
    name: 'Ford Mustang GT',
    price: 5800000,
    year: 2019,
    mileage: '30,000 km',
    fuel: 'Petrol',
    location: 'Nakuru, Kenya',
    badge: 'flash',
    badgeExtra: null,
    image: 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=600&h=360&fit=crop',
  },
]

function formatPrice(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

function Badge({ type }: { type: 'verified' | 'flash' | 'premium' }) {
  if (type === 'verified') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-gradient-to-br from-green-500 to-green-600 shadow-sm">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Verified
      </span>
    )
  }
  if (type === 'premium') {
    return (
      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold text-white bg-gradient-to-br from-green-500 to-emerald-600 shadow-sm">
        Premium
      </span>
    )
  }
  if (type === 'flash') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold text-petrol-black bg-gradient-to-br from-yellow-300 to-petrol-yellow shadow-sm">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="#0A0A0A" stroke="none">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
        FLASH DEAL
      </span>
    )
  }
  return null
}

function ListingCard({ listing }: { listing: Listing }) {
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative w-full" style={{ paddingTop: '56%' }}>
        <img
          src={listing.image}
          alt={listing.name}
          onLoad={() => setImgLoaded(true)}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0'}`}
        />
        {!imgLoaded && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-petrol-yellow border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Badge overlays */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex justify-between items-start">
          <div>
            {listing.badge === 'flash' && <Badge type="flash" />}
          </div>
          <div className="flex gap-1.5">
            {listing.badge === 'verified' && <Badge type="verified" />}
            {listing.badge === 'premium' && <Badge type="premium" />}
            {listing.badgeExtra === 'verified' && <Badge type="verified" />}
            {listing.badgeExtra === 'premium' && <Badge type="premium" />}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3.5">
        <h3 className="text-base font-bold text-petrol-black">{listing.name}</h3>
        <p className="text-xl font-extrabold text-petrol-yellow mt-1 tracking-tight">
          {formatPrice(listing.price)}
        </p>

        {/* Metadata row */}
        <div className="flex items-center gap-3.5 mt-2.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-xs text-petrol-gray">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {listing.year}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-petrol-gray">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {listing.mileage}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-petrol-gray">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 22V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" />
              <path d="M15 10h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2v0a2 2 0 0 0 2-2V9l-3-3" />
              <rect x="6" y="8" width="6" height="4" rx="1" />
            </svg>
            {listing.fuel}
          </span>
        </div>

        {/* Location */}
        <div className="flex items-center gap-1 mt-2 text-xs text-petrol-gray">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FDB913" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
          {listing.location}
        </div>
      </div>
    </div>
  )
}

export default function MarketplacePage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'kenya' | 'global'>('kenya')
  const [searchText, setSearchText] = useState('')

  const filtered = LISTINGS.filter(
    (l) =>
      l.name.toLowerCase().includes(searchText.toLowerCase()) ||
      l.location.toLowerCase().includes(searchText.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-100 max-w-[430px] mx-auto relative">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white shadow-sm">
        {/* Title row */}
        <div className="flex items-center px-4 pt-3 pb-2">
          <button onClick={() => router.back()} className="text-petrol-black">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="flex-1 text-center text-xl font-extrabold text-petrol-black pr-[22px]">
            Marketplace
          </h1>
        </div>

        {/* Search row */}
        <div className="flex items-center gap-2.5 px-4 pb-3">
          <div className="flex-1 flex items-center gap-2 bg-gray-100 border border-gray-200 rounded-xl px-3.5 py-2.5 focus-within:border-petrol-yellow transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search vehicles, parts..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm text-petrol-black placeholder:text-gray-400"
            />
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FDB913" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>

          {/* Filter button */}
          <button className="w-11 h-11 rounded-xl bg-gradient-to-br from-petrol-yellow to-yellow-600 flex items-center justify-center shadow-md active:scale-95 transition-transform">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="8" y1="12" x2="16" y2="12" />
              <line x1="11" y1="18" x2="13" y2="18" />
              <circle cx="7" cy="6" r="2" fill="white" />
              <circle cx="14" cy="12" r="2" fill="white" />
            </svg>
          </button>
        </div>

        {/* Kenya / Global tabs */}
        <div className="flex px-4 pb-3 gap-0">
          <button
            onClick={() => setActiveTab('kenya')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'kenya'
                ? 'bg-gradient-to-r from-petrol-yellow to-yellow-600 text-white shadow-md'
                : 'bg-transparent text-petrol-gray'
            }`}
          >
            Kenya
          </button>
          <button
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
              activeTab === 'global'
                ? 'bg-gradient-to-r from-petrol-yellow to-yellow-600 text-white shadow-md'
                : 'bg-transparent text-petrol-gray'
            }`}
          >
            Global
          </button>
        </div>
      </div>

      {/* Feed */}
      <div className="px-4 pt-3 pb-24 flex flex-col gap-4">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-petrol-gray">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p className="text-sm">No vehicles found matching &quot;{searchText}&quot;</p>
          </div>
        ) : (
          filtered.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))
        )}
      </div>

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  )
}
