import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Petrol Goons Garage — Book Your Car Service'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0A0A0A',
          position: 'relative',
        }}
      >
        {/* Racing stripe at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            display: 'flex',
          }}
        >
          <div style={{ flex: 1, backgroundColor: '#ffffff' }} />
          <div style={{ flex: 1, backgroundColor: '#C41E3A' }} />
          <div style={{ flex: 1, backgroundColor: '#1B2A4A' }} />
          <div style={{ flex: 1, backgroundColor: '#FDB913' }} />
          <div style={{ flex: 1, backgroundColor: '#00B4D8' }} />
        </div>

        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            marginBottom: '24px',
          }}
        >
          <span
            style={{
              fontSize: '72px',
              fontWeight: 900,
              fontStyle: 'italic',
              color: '#22C55E',
              letterSpacing: '-0.02em',
            }}
          >
            PETROL
          </span>
          <span
            style={{
              fontSize: '72px',
              fontWeight: 900,
              fontStyle: 'italic',
              backgroundColor: '#FDB913',
              color: '#0A0A0A',
              padding: '4px 16px',
              marginLeft: '8px',
              transform: 'skewX(-6deg)',
              letterSpacing: '-0.02em',
            }}
          >
            GOONS
          </span>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: '20px',
            color: '#FDB913',
            letterSpacing: '0.3em',
            fontWeight: 600,
            marginBottom: '40px',
          }}
        >
          TUNERSHOP
        </div>

        {/* CTA */}
        <div
          style={{
            fontSize: '36px',
            fontWeight: 700,
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.3,
            marginBottom: '16px',
          }}
        >
          Book your car service in 30 seconds
        </div>

        <div
          style={{
            fontSize: '22px',
            color: '#9CA3AF',
            textAlign: 'center',
          }}
        >
          Oil change · Brakes · Suspension · Diagnostics · Detailing & more
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px', color: '#22C55E', fontWeight: 600 }}>
            @petrol_goons
          </span>
          <span style={{ fontSize: '18px', color: '#4B5563' }}>
            •
          </span>
          <span style={{ fontSize: '18px', color: '#6B7280' }}>
            Nairobi, Kenya
          </span>
        </div>

        {/* Racing stripe at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '8px',
            display: 'flex',
          }}
        >
          <div style={{ flex: 1, backgroundColor: '#ffffff' }} />
          <div style={{ flex: 1, backgroundColor: '#C41E3A' }} />
          <div style={{ flex: 1, backgroundColor: '#1B2A4A' }} />
          <div style={{ flex: 1, backgroundColor: '#FDB913' }} />
          <div style={{ flex: 1, backgroundColor: '#00B4D8' }} />
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
