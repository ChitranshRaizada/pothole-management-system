import React from 'react'

interface CivicPulseLogoProps {
  className?: string
  size?: number
  showText?: boolean
  variant?: 'light' | 'dark'
}

export const CivicPulseLogo: React.FC<CivicPulseLogoProps> = ({
  className = '',
  size = 38,
  showText = false,
  variant = 'light',
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Custom Civic Pulse Logo Mark */}
      <div
        style={{ width: size, height: size }}
        className="relative rounded-xl bg-gradient-to-br from-[#5B1A2A] to-[#2A0F16] border border-[#B08D7A]/40 flex items-center justify-center shrink-0 shadow-xs transition-transform group-hover:scale-105"
      >
        <svg
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-5/6 h-5/6"
        >
          {/* Subtle civic shield contour */}
          <path
            d="M16 4C19.5 7.5 24 8 26 8.5C26 18 19.5 24 16 27C12.5 24 6 18 6 8.5C8 8 12.5 7.5 16 4Z"
            fill="#2A0F16"
            fillOpacity="0.4"
            stroke="#B08D7A"
            strokeWidth="1"
            strokeOpacity="0.3"
          />
          {/* Dynamic Pulse / Heartbeat Waveform */}
          <path
            d="M7 16H11L13 13L15.5 20L18 9L20.5 18L22 15H25"
            stroke="#B08D7A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Pulse beacon dot */}
          <circle cx="18" cy="9" r="1.5" fill="#F2E7E1" />
        </svg>
      </div>

      {showText && (
        <div className="flex flex-col">
          <span
            className={`font-black tracking-tight text-base sm:text-lg leading-tight ${
              variant === 'dark' ? 'text-[#F2E7E1]' : 'text-[#2A0F16]'
            }`}
          >
            Civic Pulse
          </span>
          <span className="text-[9px] uppercase font-bold tracking-[0.18em] text-[#B08D7A]">
            CIVIC ISSUE REPORTING
          </span>
        </div>
      )}
    </div>
  )
}

