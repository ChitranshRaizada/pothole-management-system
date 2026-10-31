import React, { useRef, useState } from 'react'
import { Camera, Upload, X, CheckCircle2, AlertCircle } from 'lucide-react'

const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024 // 8 MB limit
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

interface PhotoCaptureProps {
  photoFile: File | null
  photoPreview: string | null
  onPhotoSelected: (file: File) => void
  onPhotoRemoved: () => void
}

export const PhotoCapture: React.FC<PhotoCaptureProps> = ({
  photoFile,
  photoPreview,
  onPhotoSelected,
  onPhotoRemoved,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [isValidating, setIsValidating] = useState(false)

  const validateAndSelectFile = async (file: File) => {
    setValidationError(null)

    // 1. File size check (8 MB limit)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
      setValidationError(`Photo exceeds the 8 MB limit (${sizeMB} MB). Please choose a smaller image.`)
      return
    }

    // 2. MIME type check (JPEG, PNG, WebP)
    const fileType = file.type.toLowerCase()
    if (!ALLOWED_MIME_TYPES.includes(fileType)) {
      setValidationError('Invalid image format. Only JPEG, PNG, and WebP formats are accepted.')
      return
    }

    // 3. Image content validation (Ensure real renderable image and not disguised file)
    setIsValidating(true)
    try {
      const objectUrl = URL.createObjectURL(file)
      await new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(objectUrl)
          resolve()
        }
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl)
          reject(new Error('Corrupted or invalid image file.'))
        }
        img.src = objectUrl
      })

      setIsValidating(false)
      onPhotoSelected(file)
    } catch {
      setIsValidating(false)
      setValidationError('Could not load or decode the image. Please select a valid photo.')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSelectFile(file)
    }
    // Reset input value so same file can be re-selected if needed
    e.target.value = ''
  }

  const handleRemove = () => {
    setValidationError(null)
    onPhotoRemoved()
  }

  return (
    <div className="space-y-4">
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment" // Forces rear camera on mobile devices
        onChange={handleFileChange}
        className="hidden"
      />

      {photoPreview ? (
        <div className="relative rounded-2xl overflow-hidden border border-[#B08D7A]/30 bg-white shadow-xs">
          <img
            src={photoPreview}
            alt="Pothole capture preview"
            className="w-full h-64 sm:h-72 object-cover"
          />
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full text-xs font-semibold text-emerald-800 border border-emerald-300 flex items-center gap-1.5 shadow-sm">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            Photo Attached ({Math.round((photoFile?.size || 0) / 1024)} KB)
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-3 right-3 p-2 rounded-full bg-[#2A0F16] hover:bg-[#5B1A2A] text-white shadow-md transition cursor-pointer"
            aria-label="Remove photo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Quick Camera Snapshot Button */}
          <button
            type="button"
            disabled={isValidating}
            onClick={() => cameraInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#FAF5F2]/80 hover:bg-[#FAF5F2] border border-[#B08D7A]/35 hover:border-[#5B1A2A] active:scale-[0.99] transition-all text-center cursor-pointer group shadow-2xs disabled:opacity-60"
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-[#B08D7A]/30 text-[#5B1A2A] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform shadow-xs">
              <Camera className="w-5 h-5 text-[#5B1A2A]" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#2A0F16]">Take Camera Photo</span>
            <span className="text-[11px] text-zinc-500 mt-0.5">Direct roadside capture</span>
          </button>

          {/* Upload from Gallery Button */}
          <button
            type="button"
            disabled={isValidating}
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center justify-center p-6 rounded-2xl bg-[#FAF5F2]/80 hover:bg-[#FAF5F2] border border-[#B08D7A]/35 hover:border-[#5B1A2A] active:scale-[0.99] transition-all text-center cursor-pointer group shadow-2xs disabled:opacity-60"
          >
            <div className="w-12 h-12 rounded-xl bg-white border border-[#B08D7A]/30 text-[#5B1A2A] flex items-center justify-center mb-2.5 group-hover:scale-105 transition-transform shadow-xs">
              <Upload className="w-5 h-5 text-[#5B1A2A]" />
            </div>
            <span className="text-xs sm:text-sm font-bold text-[#2A0F16]">Upload from Gallery</span>
            <span className="text-[11px] text-zinc-500 mt-0.5">JPEG, PNG, or WebP (max 8 MB)</span>
          </button>
        </div>
      )}

      {/* Validation Error Message */}
      {validationError && (
        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  )
}
