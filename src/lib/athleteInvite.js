// Shared between AthleteInviteAccept and AthleteLogin: if a Supabase project
// requires email confirmation, signUp() won't return a session immediately,
// so we can't call claim_athlete_invite (which needs auth.uid()) right away.
// Stash the token and finish the claim the next time this browser actually
// logs in as that athlete.
export const PENDING_INVITE_KEY = 'chalkup_pending_invite_token'

// Called only after authentication and the coach-role check. The server RPC
// validates the invite against the authenticated account; a saved token alone
// never grants athlete access. Keep it until the linked row is visible.
export async function finishPendingAthleteInvite({ token, email, claim, findAthlete, clear }) {
  if (!token) return { athlete: null, error: null }
  const { error } = await claim(token, email)
  if (error) return { athlete: null, error }
  const result = await findAthlete()
  if (result.error || !result.data) return { athlete: null, error: result.error || null }
  clear()
  return { athlete: result.data, error: null }
}
