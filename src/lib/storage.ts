import { supabase, isSupabaseConfigured } from './supabase'

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>()

export const BUCKET_NAME = 'pothole-reports'

/**
 * Normalizes a storage path by removing leading bucket names or slashes
 */
export function normalizeStoragePath(rawPath?: string | null): string {
  if (!rawPath) return ''
  let path = rawPath.trim()
  if (path.startsWith(`${BUCKET_NAME}/`)) {
    path = path.slice(BUCKET_NAME.length + 1)
  }
  if (path.startsWith('/')) {
    path = path.slice(1)
  }
  return path
}

/**
 * Resolves a signed URL for a private file in 'pothole-reports' with in-memory caching.
 * If the input is already an HTTP, blob or data URL, it is returned directly.
 */
export async function getSignedPhotoUrl(
  pathOrUrl?: string | null,
  expiresInSeconds = 3600
): Promise<string> {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') return ''

  const trimmed = pathOrUrl.trim()
  if (!trimmed) return ''

  // Already a full or blob URL
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    // If it's an old dead public URL for our private bucket, try extracting the storage path
    const privateMarker = `/storage/v1/object/public/${BUCKET_NAME}/`
    if (trimmed.includes(privateMarker)) {
      const extractedPath = trimmed.split(privateMarker)[1]
      if (extractedPath) {
        return getSignedPhotoUrl(extractedPath, expiresInSeconds)
      }
    }
    return trimmed
  }

  if (!isSupabaseConfigured) return ''

  const cleanPath = normalizeStoragePath(trimmed)
  if (!cleanPath) return ''

  // Check memory cache
  const cached = signedUrlCache.get(cleanPath)
  const now = Date.now()
  if (cached && cached.expiresAt > now) {
    return cached.url
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(cleanPath, expiresInSeconds)

    if (error) {
      console.warn(`[Storage] Failed to create signed URL for path "${cleanPath}":`, error.message)
      return ''
    }

    if (data?.signedUrl) {
      // Expire cache 60s before actual token expiration
      const ttlMs = Math.max((expiresInSeconds - 60) * 1000, 30000)
      signedUrlCache.set(cleanPath, {
        url: data.signedUrl,
        expiresAt: now + ttlMs,
      })
      return data.signedUrl
    }
  } catch (err) {
    console.warn(`[Storage] Error resolving signed URL for "${cleanPath}":`, err)
  }

  return ''
}

/**
 * Resolves multiple storage paths to signed URLs in batch.
 */
export async function getBatchSignedPhotoUrls(
  paths: string[],
  expiresInSeconds = 3600
): Promise<Record<string, string>> {
  const result: Record<string, string> = {}
  const missingPaths: string[] = []
  const now = Date.now()

  for (const raw of paths) {
    const clean = normalizeStoragePath(raw)
    if (!clean) continue

    const cached = signedUrlCache.get(clean)
    if (cached && cached.expiresAt > now) {
      result[raw] = cached.url
      result[clean] = cached.url
    } else {
      missingPaths.push(clean)
    }
  }

  if (missingPaths.length === 0 || !isSupabaseConfigured) {
    return result
  }

  try {
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrls(missingPaths, expiresInSeconds)

    if (!error && Array.isArray(data)) {
      data.forEach((item) => {
        if (item.signedUrl && item.path) {
          const ttlMs = Math.max((expiresInSeconds - 60) * 1000, 30000)
          signedUrlCache.set(item.path, {
            url: item.signedUrl,
            expiresAt: now + ttlMs,
          })
          result[item.path] = item.signedUrl
        }
      })
    } else {
      // Fallback sequentially
      await Promise.all(
        missingPaths.map(async (p) => {
          const url = await getSignedPhotoUrl(p, expiresInSeconds)
          if (url) result[p] = url
        })
      )
    }
  } catch (err) {
    console.warn('[Storage] Batch sign error, falling back:', err)
  }

  return result
}

