const MAX_GOALS = 20

function sanitizeGoals(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 2)
  if (digits === '') return ''
  return String(Math.min(MAX_GOALS, Number(digits)))
}

export function ScoreInput({
  value,
  onChange,
  ariaLabel,
  disabled = false,
}: {
  value: string
  onChange: (next: string) => void
  ariaLabel: string
  disabled?: boolean
}) {
  return (
    <input
      className="score-input"
      inputMode="numeric"
      pattern="[0-9]*"
      enterKeyHint="done"
      autoComplete="off"
      maxLength={2}
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(e) => onChange(sanitizeGoals(e.target.value))}
      onFocus={(e) => e.target.select()}
    />
  )
}
