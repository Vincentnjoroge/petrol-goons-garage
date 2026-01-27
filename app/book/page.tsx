'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const SERVICES = [
  'Oil change',
  'Air filter exchange',
  'Tyres',
  'Brake pads',
  'Suspension changes/fixes',
  'Computer diagnostics',
  'Body kits',
  'Detailing services',
  'Other'
]

export default function BookingPage() {
  const router = useRouter()
  const [formData, setFormData] = useState({
    vinNumber: '',
    service: '',
    otherService: '',
    description: '',
    preferredDate: '',
    preferredTime: '',
  })
  const [photos, setPhotos] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Will implement Firebase save next
    console.log('Booking submitted:', formData, photos)

    // Simulate submission
    setTimeout(() => {
      setIsSubmitting(false)
      alert('Booking request submitted! We\'ll review it and send you a confirmation email.')
      router.push('/dashboard')
    }, 1000)
  }

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setPhotos(Array.from(e.target.files))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-petrol-black text-white p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center space-x-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">
            <span className="text-petrol-yellow">PETROL GOONS</span> GARAGE
          </h1>
          <div className="w-6"></div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto p-4 py-8">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-petrol-black mb-2">Book a Service</h2>
          <p className="text-petrol-gray mb-6">Fill in the details below and we'll get back to you</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* VIN Number */}
            <div>
              <label htmlFor="vinNumber" className="block text-sm font-medium text-petrol-black mb-2">
                VIN / Chassis Number *
              </label>
              <input
                type="text"
                id="vinNumber"
                required
                value={formData.vinNumber}
                onChange={(e) => setFormData({...formData, vinNumber: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-petrol-yellow focus:border-transparent outline-none"
                placeholder="Enter your vehicle's VIN or chassis number"
              />
            </div>

            {/* Service Selection */}
            <div>
              <label htmlFor="service" className="block text-sm font-medium text-petrol-black mb-2">
                Service Required *
              </label>
              <select
                id="service"
                required
                value={formData.service}
                onChange={(e) => setFormData({...formData, service: e.target.value})}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-petrol-yellow focus:border-transparent outline-none"
              >
                <option value="">Select a service</option>
                {SERVICES.map(service => (
                  <option key={service} value={service}>{service}</option>
                ))}
              </select>
            </div>

            {/* Other Service (if selected) */}
            {formData.service === 'Other' && (
              <div>
                <label htmlFor="otherService" className="block text-sm font-medium text-petrol-black mb-2">
                  Please specify the service *
                </label>
                <input
                  type="text"
                  id="otherService"
                  required
                  value={formData.otherService}
                  onChange={(e) => setFormData({...formData, otherService: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-petrol-yellow focus:border-transparent outline-none"
                  placeholder="What service do you need?"
                />
              </div>
            )}

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-petrol-black mb-2">
                Issue Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-petrol-yellow focus:border-transparent outline-none resize-none"
                placeholder="Tell us more about the issue or any specific requirements..."
              />
            </div>

            {/* Photo Upload */}
            <div>
              <label className="block text-sm font-medium text-petrol-black mb-2">
                Photos (Optional)
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                  id="photo-upload"
                />
                <label htmlFor="photo-upload" className="cursor-pointer">
                  <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-petrol-gray">
                    <span className="text-petrol-yellow font-medium">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-gray-500 mt-1">PNG, JPG up to 10MB</p>
                </label>
                {photos.length > 0 && (
                  <div className="mt-4 text-sm text-petrol-black">
                    {photos.length} photo(s) selected
                  </div>
                )}
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="preferredDate" className="block text-sm font-medium text-petrol-black mb-2">
                  Preferred Date *
                </label>
                <input
                  type="date"
                  id="preferredDate"
                  required
                  value={formData.preferredDate}
                  onChange={(e) => setFormData({...formData, preferredDate: e.target.value})}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-petrol-yellow focus:border-transparent outline-none"
                />
              </div>
              <div>
                <label htmlFor="preferredTime" className="block text-sm font-medium text-petrol-black mb-2">
                  Preferred Time *
                </label>
                <input
                  type="time"
                  id="preferredTime"
                  required
                  value={formData.preferredTime}
                  onChange={(e) => setFormData({...formData, preferredTime: e.target.value})}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-petrol-yellow focus:border-transparent outline-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-petrol-yellow text-petrol-black font-bold py-4 rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Booking Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
