const MAX_GOALS = 20

function sanitizeGoals(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 2)
  if (digits === '') return ''
  const n = Math.min(MAX_GOALS, Number(digits))
  return String(n)
}

export function ScoreStepper({
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
  const n = value === '' ? null : Number(value)

  function bump(delta: number) {
    const base = n ?? 0
    const next = Math.max(0, Math.min(MAX_GOALS, base + delta))
    onChange(String(next))
  }

  return (
    <div className="score-stepper">
      <button
        type="button"
        className="stepper-btn"
        aria-label={`Decrease ${ariaLabel}`}
        disabled={disabled || (n !== null && n <= 0)}
        onClick={() => bump(-1)}
      >
        −
      </button>
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
      <button
        type="button"
        className="stepper-btn"
        aria-label={`Increase ${ariaLabel}`}
        disabled={disabled || (n !== null && n >= MAX_GOALS)}
        onClick={() => bump(1)}
      >
        +
      </button>
    </div>
  )
}
