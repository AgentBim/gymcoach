import { supabase } from './supabase'

// Google sign-in for both portals. The provider has to be enabled in Supabase
// (Authentication > Providers > Google) and this app's /auth/callback URL
// allow-listed under Redirect URLs.
//
// `path` is where Google sends the person back to: /auth/callback?role=coach
// or ?role=athlete (checks which kind of account signed in), or an invite URL
// (which finishes claiming the invite itself).
export async function signInWithGoogle(path) {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${path}`, queryParams: { prompt: 'select_account' } },
  })
  return { error }
}

export const googleErrorMessage = error =>
  /provider is not enabled|unsupported provider/i.test(error?.message || '')
    ? 'Google sign-in isn’t switched on for this app yet.'
    : error?.message || 'Google sign-in failed. Try again.'
