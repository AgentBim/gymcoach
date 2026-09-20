// Shared between AthleteInviteAccept and AthleteLogin: if a Supabase project
// requires email confirmation, signUp() won't return a session immediately,
// so we can't call claim_athlete_invite (which needs auth.uid()) right away.
// Stash the token and finish the claim the next time this browser actually
// logs in as that athlete.
export const PENDING_INVITE_KEY = 'chalkup_pending_invite_token'
