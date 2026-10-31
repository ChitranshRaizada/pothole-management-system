import React, { useState, useEffect } from 'react'
import { getSignedPhotoUrl } from '../../lib/storage'
import { ImageIcon, Maximize2, X, Loader2 } from 'lucide-react'

interface PotholeImageProps {
  src?: string | null
  storagePath?: string | null
  alt: string
  className?: string
  containerClassName?: string
  allowExpand?: boolean
  aspectRatio?: string
  badge?: React.ReactNode
}

export const PotholeImage: React.FC<PotholeImageProps> = ({
  src,
  storagePath,
  alt,
  className = 'w-full h-full object-cover',
  containerClassName = 'relative w-full h-full bg-[#150B10] overflow-hidden',
  allowExpand = true,
  badge,
}) => {
  const [displayUrl, setDisplayUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [hasError, setHasError] = useState<boolean>(false)
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)

  useEffect(() => {
    let isMounted = true

    async function resolveUrl() {
      setIsLoading(true)
      setHasError(false)

      // 1. Direct valid URL provided (HTTP, blob or data)
      if (src && (src.startsWith('http') || src.startsWith('blob:') || src.startsWith('data:'))) {
        // Check if it's not a broken public link to private bucket
        if (!src.includes('/storage/v1/object/public/pothole-reports/')) {
          if (isMounted) {
            setDisplayUrl(src)
            setIsLoading(false)
          }
          return
        }
      }

      // 2. Resolve via signed URL from storagePath or src path
      const targetPath = storagePath || src
      if (targetPath) {
        const signed = await getSignedPhotoUrl(targetPath)
        if (isMounted) {
          if (signed) {
            setDisplayUrl(signed)
          } else {
            setHasError(true)
          }
          setIsLoading(false)
        }
      } else {
        if (isMounted) {
          setIsLoading(false)
          setHasError(true)
        }
      }
    }

    resolveUrl()

    return () => {
      isMounted = false
    }
  }, [src, storagePath])

  return (
    <>
      <div className={containerClassName}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#1D0F16] animate-pulse">
            <Loader2 className="w-5 h-5 text-[#B08D7A] animate-spin" />
          </div>
        )}

        {hasError || (!displayUrl && !isLoading) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-3 text-center bg-[#150B10] text-[#B08D7A]/60">
            <ImageIcon className="w-6 h-6 stroke-[1.5]" />
            <span className="text-[10px] font-medium tracking-wide">Photo unavailable</span>
          </div>
        ) : (
          <>
            <img
              src={displayUrl}
              alt={alt}
              className={`${className} transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setHasError(true)
                setIsLoading(false)
              }}
              loading="lazy"
            />

            {badge && <div className="absolute top-2 left-2 pointer-events-none">{badge}</div>}

            {allowExpand && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsModalOpen(true)
                }}
                className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white hover:text-[#B08D7A] transition backdrop-blur-xs cursor-pointer shadow-md"
                title="Expand photograph"
                aria-label="Expand photograph"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            )}
          </>
        )}
      </div>

      {/* Modal Lightbox for High-Resolution Inspection */}
      {isModalOpen && displayUrl && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 sm:p-6"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] w-full flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between pb-3 text-white">
              <span className="text-xs font-mono font-bold tracking-wider text-[#B08D7A]">
                {alt || 'Defect Evidence'}
              </span>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
                aria-label="Close image modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative rounded-2xl overflow-hidden border border-[#5B1A2A] bg-black shadow-2xl max-h-[80vh] flex items-center justify-center">
              <img
                src={displayUrl}
                alt={alt}
                className="max-h-[78vh] w-auto max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
