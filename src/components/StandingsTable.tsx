import { Fragment, useState } from 'react'
import { playerTipsByMatchday } from '../lib/matchday'
import type { MatchRow, StandingsRow, TipRow } from '../lib/matches'

type Row = StandingsRow

export function StandingsTable({
  rows,
  matches,
  tips,
  userId,
}: {
  rows: Row[]
  matches: MatchRow[]
  tips: TipRow[]
  userId: string
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  return (
    <div className="standings-table-wrap">
      <table className="standings-table">
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
                    <td colSpan={7}>
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
