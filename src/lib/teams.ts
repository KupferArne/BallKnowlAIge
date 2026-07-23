/** Heuristic: KO placeholders / bracket slots (long, hard to scan on mobile). */
export function isPlaceholderTeam(name: string): boolean {
  const t = name.trim()
  if (!t) return false
  if (/^(winner|loser|runner[- ]?up)\b/i.test(t)) return true
  if (/\b(winner|loser)\s+of\b/i.test(t)) return true
  if (/^(1|2)[A-L]$/i.test(t)) return true
  if (/^[WwLl]\d{1,3}$/.test(t)) return true
  if (/\bvs\.?\b/i.test(t)) return true
  if (t.includes('/') && t.length > 8) return true
  return false
}

export function teamNameClass(name: string): string {
  return isPlaceholderTeam(name) ? 'team-name is-placeholder' : 'team-name'
}
