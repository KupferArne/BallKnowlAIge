export type LeagueRole = 'owner' | 'player'

export type LeagueRow = {
  id: string
  name: string
  owner_id: string
  invite_token: string
  created_at: string
  my_role: LeagueRole
}

export type Profile = {
  id: string
  display_name: string
  created_at: string
}
