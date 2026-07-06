/**
 * Geo helpers — distance + history-based garage ranking. No external deps.
 */

export interface GeoGarage {
  id: string
  name: string
  location: string
  lat?: number | null
  lng?: number | null
  servicesOffered: string[]
  description?: string
  status?: string
}

/** Haversine distance in km. */
export function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371
  const dLat = ((bLat - aLat) * Math.PI) / 180
  const dLng = ((bLng - aLng) * Math.PI) / 180
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s))
}

/**
 * Rank garages: (1) ones the user has history with, most-used first,
 * (2) then by distance if we have the user's position, (3) then A–Z.
 * historyCounts: { [garageId]: jobCount } built from the user's past jobs.
 */
export function rankGarages(
  garages: GeoGarage[],
  historyCounts: Record<string, number>,
  userPos?: { lat: number; lng: number } | null
): GeoGarage[] {
  return [...garages].sort((a, b) => {
    const ha = historyCounts[a.id] || 0
    const hb = historyCounts[b.id] || 0
    if (ha !== hb) return hb - ha
    if (userPos && a.lat && a.lng && b.lat && b.lng) {
      return (
        distanceKm(userPos.lat, userPos.lng, a.lat, a.lng) -
        distanceKm(userPos.lat, userPos.lng, b.lat, b.lng)
      )
    }
    return a.name.localeCompare(b.name)
  })
}

export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}
