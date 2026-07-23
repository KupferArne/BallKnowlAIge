/** Normalize Supabase / unknown thrown values into a readable message. */
export function formatSupabaseError(err: unknown): string {
  if (err == null) return 'Unknown error'
  if (typeof err === 'string') return err
  if (err instanceof Error && err.message) return err.message

  if (typeof err === 'object') {
    const e = err as {
      message?: string
      details?: string
      hint?: string
      code?: string
      error_description?: string
    }
    const parts = [e.message, e.details, e.hint, e.error_description, e.code].filter(
      (p): p is string => Boolean(p && String(p).trim()),
    )
    if (parts.length) return parts.join(' — ')
  }

  try {
    return JSON.stringify(err)
  } catch {
    return 'Unknown error'
  }
}

export function asError(err: unknown): Error {
  if (err instanceof Error) return err
  return new Error(formatSupabaseError(err))
}
