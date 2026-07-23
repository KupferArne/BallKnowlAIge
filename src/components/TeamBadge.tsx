import { useState } from 'react'
import {
  resolveTeamIcon,
  type TeamIconKind,
} from '../lib/teamIcons'

export function TeamBadge({
  name,
  crestUrl,
  kind = 'auto',
  align = 'start',
}: {
  name: string
  crestUrl?: string | null
  kind?: TeamIconKind
  align?: 'start' | 'end'
}) {
  const icon = resolveTeamIcon(name, { kind, crestUrl })
  const [broken, setBroken] = useState(false)
  const showImg = icon.src && !broken

  return (
    <span
      className={`team-badge team-badge-${align}`}
      title={name}
    >
      {align === 'end' && (
        <span className="team-badge-name">{name}</span>
      )}
      {showImg ? (
        <img
          className={`team-icon team-icon-${icon.type}`}
          src={icon.src}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setBroken(true)}
        />
      ) : (
        <span className="team-icon team-icon-fallback" aria-hidden>
          {icon.initials}
        </span>
      )}
      {align === 'start' && (
        <span className="team-badge-name">{name}</span>
      )}
    </span>
  )
}
