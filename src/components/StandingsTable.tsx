import { Fragment, useMemo, useState } from 'react'
import { playerTipsByMatchday } from '../lib/matchday'
import type { MatchRow, StandingsRow, TipRow } from '../lib/matches'
import { isTipLocked } from '../lib/scoring'
import {
  resolveTeamIcon,
  type TeamIconKind,
} from '../lib/teamIcons'

type Row = StandingsRow

const PREVIEW_LIMIT = 5

/** Next unfinished matches by kickoff (up to 5). */
export function previewMatches(matches: MatchRow[], limit = PREVIEW_LIMIT): MatchRow[] {
  return [...matches]
    .filter((m) => m.status !== 'finished')
    .sort((a, b) => {
      const ta = a.kickoff_at ? new Date(a.kickoff_at).getTime() : Number.MAX_SAFE_INTEGER
      const tb = b.kickoff_at ? new Date(b.kickoff_at).getTime() : Number.MAX_SAFE_INTEGER
      return ta - tb
    })
    .slice(0, limit)
}

/**
 * Cell label for a player's tip on a preview match:
 * no tip → — ; tipped before kickoff (others) → -:- ; revealed → h:a
 * Own tip before kickoff shows the real score.
 */
export function tipPreviewLabel(
  tip: TipRow | undefined,
  match: MatchRow,
  viewerId: string,
): string {
  if (!tip) return '—'
  const locked = isTipLocked(match.kickoff_at)
  const isSelf = tip.user_id === viewerId
  const hasScores = tip.home_goals !== null && tip.away_goals !== null

  if (!locked && !isSelf) return '-:-'
  if (!hasScores) return '-:-'
  return `${tip.home_goals}:${tip.away_goals}`
}

function MatchLogos({
  match,
  kind,
}: {
  match: MatchRow
  kind: TeamIconKind
}) {
  const home = resolveTeamIcon(match.home_team, {
    kind,
    crestUrl: match.home_crest_url,
  })
  const away = resolveTeamIcon(match.away_team, {
    kind,
    crestUrl: match.away_crest_url,
  })

  return (
    <span
      className="lb-match-logos"
      title={`${match.home_team} vs ${match.away_team}`}
    >
      {home.src ? (
        <img className="lb-match-logo" src={home.src} alt="" loading="lazy" />
      ) : (
        <span className="lb-match-logo lb-match-logo-fallback">{home.initials}</span>
      )}
      <span className="lb-match-vs" aria-hidden>
        –
      </span>
      {away.src ? (
        <img className="lb-match-logo" src={away.src} alt="" loading="lazy" />
      ) : (
        <span className="lb-match-logo lb-match-logo-fallback">{away.initials}</span>
      )}
    </span>
  )
}

export function StandingsTable({
  rows,
  matches,
  tips,
  userId,
  iconKind = 'auto',
}: {
  rows: Row[]
  matches: MatchRow[]
  tips: TipRow[]
  userId: string
  iconKind?: TeamIconKind
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const previews = useMemo(() => previewMatches(matches), [matches])
  const colCount = 7 + previews.length

  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
        <colgroup>
          <col className="col-rank" />
          <col className="col-player" />
          <col className="col-lb-pts" />
          {previews.map((m, i) => (
            <col
              key={m.id}
              className={`col-lb-match${i >= 3 ? ' hide-xs' : ''}${i >= 4 ? ' hide-sm' : ''}`}
            />
          ))}
          <col className="col-exact hide-xs" />
          <col className="col-tipped hide-xs" />
          <col className="col-bonus hide-sm" />
          <col className="col-expand" />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="col-rank">
              #
            </th>
            <th scope="col" className="col-player">
              Player
            </th>
            <th scope="col" className="col-lb-pts">
              Pts
            </th>
            {previews.map((m, i) => (
              <th
                key={m.id}
                scope="col"
                className={`col-lb-match${i >= 3 ? ' hide-xs' : ''}${i >= 4 ? ' hide-sm' : ''}`}
              >
                <MatchLogos match={m} kind={iconKind} />
              </th>
            ))}
            <th scope="col" className="col-exact hide-xs">
              Exact
            </th>
            <th scope="col" className="col-tipped hide-xs">
              Tips
            </th>
            <th scope="col" className="col-bonus hide-sm">
              Bonus
            </th>
            <th scope="col" className="col-expand">
              <span className="sr-only">Details</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const isYou = row.userId === userId
            const open = expandedId === row.userId
            const groups = open
              ? playerTipsByMatchday(row.userId, matches, tips, userId)
              : []

            return (
              <Fragment key={row.userId}>
                <tr className={isYou ? 'standing-tr is-you' : 'standing-tr'}>
                  <td className="col-rank">{i + 1}</td>
                  <td className="col-player">
                    <button
                      type="button"
                      className="standing-name-btn"
                      onClick={() =>
                        setExpandedId((id) =>
                          id === row.userId ? null : row.userId,
                        )
                      }
                      aria-expanded={open}
                    >
                      <span className={isYou ? 'is-you-name' : undefined}>
                        {row.name}
                        {isYou ? ' (you)' : ''}
                      </span>
                    </button>
                    <span className="muted standing-meta-mobile">
                      {row.exact} exact · {row.tipped} tips
                      {row.bonusPoints ? ` · ${row.bonusPoints}b` : ''}
                    </span>
                  </td>
                  <td className="col-lb-pts">
                    <strong>{row.points}</strong>
                  </td>
                  {previews.map((m, mi) => {
                    const tip = tips.find(
                      (t) => t.match_id === m.id && t.user_id === row.userId,
                    )
                    const label = tipPreviewLabel(tip, m, userId)
                    return (
                      <td
                        key={m.id}
                        className={`col-lb-match${mi >= 3 ? ' hide-xs' : ''}${mi >= 4 ? ' hide-sm' : ''}${label === '-:-' ? ' is-tipped-hidden' : ''}${label !== '—' && label !== '-:-' ? ' is-tip-revealed' : ''}`}
                      >
                        {label}
                      </td>
                    )
                  })}
                  <td className="col-exact hide-xs">{row.exact}</td>
                  <td className="col-tipped hide-xs">{row.tipped}</td>
                  <td className="col-bonus hide-sm">{row.bonusPoints || '—'}</td>
                  <td className="col-expand">
                    <button
                      type="button"
                      className="linkish"
                      onClick={() =>
                        setExpandedId((id) =>
                          id === row.userId ? null : row.userId,
                        )
                      }
                      aria-expanded={open}
                      aria-label={open ? 'Hide details' : 'Show details'}
                    >
                      {open ? '▾' : '▸'}
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr className="standing-detail-tr">
                    <td colSpan={colCount}>
                      <div className="player-detail">
                        {groups.length === 0 ? (
                          <p className="muted">No visible tips yet.</p>
                        ) : (
                          groups.map((g) => (
                            <div key={g.day} className="matchday-block">
                              <div className="matchday-head">
                                <strong>{g.day}</strong>
                                <span className="muted">{g.dayPoints} pts</span>
                              </div>
                              <ul className="matchday-lines">
                                {g.lines.map((line) => (
                                  <li key={line.matchId}>
                                    <span>{line.label}</span>
                                    <span>
                                      tip {line.tipLabel}
                                      {line.points != null
                                        ? ` · ${line.points} pts`
                                        : ''}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
