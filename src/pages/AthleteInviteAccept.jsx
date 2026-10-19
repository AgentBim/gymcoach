import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { AuthShell, AuthField, AuthSubmit, AuthMessage, AuthLinkButton, AuthGoogleButton, AuthDivider } from '../components/AuthShell'
import { PENDING_INVITE_KEY } from '../lib/athleteInvite'
import { signInWithGoogle, googleErrorMessage } from '../lib/oauth'

export default function AthleteInviteAccept() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [athlete, setAthlete] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const [googling, setGoogling] = useState(false)

  useEffect(() => { init() }, [token])

  async function init() {
    // If this load already has a live session, we most likely arrived via
    // the signUp() email-confirmation redirect (set to land back on this
    // same URL) rather than a cold anonymous visit. Finish the claim right
    // here instead of showing the form again — this doesn't depend on
    // localStorage surviving the redirect, which breaks whenever the
    // confirmation link opens in a different browser/app than where
    // signup started (very common with mobile mail clients), the actual
    // cause of a real athlete ending up with a working login but no link
    // to their roster row.
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      await supabase.rpc('claim_athlete_invite', { p_invite_token: token, p_email: session.user.email })
      const { data: athleteRow } = await supabase.from('athletes').select('id').eq('user_id', session.user.id).single()
      if (athleteRow) { navigate('/athlete'); return }
      // Claim failed and this session isn't linked to any athlete row —
      // genuinely invalid/expired/already-used-by-someone-else link.
      setNotFound(true)
      setLoading(false)
      return
    }

    fetchInvite()
  }

  async function fetchInvite() {
    // A raw table select here would silently return nothing: RLS on
    // `athletes` only allows authenticated reads, and this page is
    // necessarily hit by an anonymous, not-yet-signed-up visitor. Route
    // through the same anon-safe RPC pattern as the rest of the app's
    // pre-signup flows instead.
    const { data } = await supabase.rpc('get_athlete_invite', { p_invite_token: token })
    const invite = data?.[0]

    if (!invite) { setNotFound(true); setLoading(false); return }
    setAthlete(invite)
    setLoading(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const { data, error: signUpError } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { role: 'athlete' },
        // Land back on this same invite URL after confirming — the `init`
        // effect above finishes the claim from there. Without this, the
        // confirmation link falls back to Supabase's default Site URL,
        // which may not even be this app's domain.
        emailRedirectTo: `${window.location.origin}/athlete/invite/${token}`,
      },
    })

    // If a previous attempt got as far as creating the auth user but failed
    // before claim_athlete_invite ran (dropped connection, closed tab), this
    // email is now "already registered" and a plain signUp can't get them
    // back in — without this fallback they'd be stuck unable to re-run the
    // invite at all. Supabase signals this either as an explicit error, or
    // (with email-confirmation anti-enumeration behavior) as a successful-
    // looking response whose user has no identities attached. Either way,
    // retry as a sign-in with the password they just entered: if that's the
    // same password they picked the first time, it recovers cleanly.
    const alreadyRegistered = /already registered/i.test(signUpError?.message || '')
      || (data?.user && data.user.identities?.length === 0)

    if (signUpError && !alreadyRegistered) {
      setError(signUpError.message)
      setSubmitting(false)
      return
    }

    let session = data?.session

    if (alreadyRegistered) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        setError('An account already exists for this email — likely from an earlier attempt. If this is yours, double-check the password, or ask your coach for a new invite link.')
        setSubmitting(false)
        return
      }
      session = signInData.session
    }

    if (session) {
      const { error: claimError } = await supabase.rpc('claim_athlete_invite', { p_invite_token: token, p_email: email })
      if (claimError) {
        setError(claimError.message)
        setSubmitting(false)
        return
      }
      navigate('/athlete')
    } else {
      // Email confirmation required before a session exists — finish the
      // claim once they come back and log in.
      localStorage.setItem(PENDING_INVITE_KEY, token)
      setNeedsConfirmation(true)
    }
    setSubmitting(false)
  }

  // Back from Google, init() sees the session and claims the invite itself.
  async function handleGoogle() {
    setError(''); setGoogling(true)
    const { error } = await signInWithGoogle(`/athlete/invite/${token}`)
    if (error) { setError(googleErrorMessage(error)); setGoogling(false) }
  }

  if (loading) return (
    <AuthShell side="athlete" eyebrow="Invite" title="One moment">
      <AuthMessage tone="info">Loading your invite…</AuthMessage>
    </AuthShell>
  )

  if (notFound) return (
    <AuthShell side="athlete" eyebrow="Invite" title="Invite not found" subtitle="This link is invalid or has already been used. Ask your coach for a new one."
      footer={<Link to="/athlete/login" style={{ color: 'var(--ac)', fontWeight: 600 }}>Already have a login? Log in →</Link>}>
      <span />
    </AuthShell>
  )

  return (
    <AuthShell side="athlete" eyebrow="Invite" title={`Welcome, ${athlete.full_name.split(' ')[0]}`} subtitle="Set up your portal login to see your workouts and keep your streak."
      footer={!needsConfirmation && <>Already set up? <Link to="/athlete/login" style={{ color: 'var(--ac)', fontWeight: 600 }}>Log in →</Link></>}>
      {needsConfirmation ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AuthMessage tone="ok">Check your email to confirm your account, then come back and log in to finish setup.</AuthMessage>
          <AuthLinkButton onClick={() => navigate('/athlete/login')}>Go to log in</AuthLinkButton>
        </div>
      ) : (
        <>
        <AuthGoogleButton onClick={handleGoogle} busy={googling}>Continue with Google</AuthGoogleButton>
        <AuthDivider>or create a password</AuthDivider>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <AuthField label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" inputMode="email" required />
          <AuthField label="Choose a password" type="password" value={password} onChange={setPassword} placeholder="At least 6 characters" autoComplete="new-password" required minLength={6} />
          {error && <AuthMessage>{error}</AuthMessage>}
          <AuthSubmit loading={submitting}>{submitting ? 'Setting up…' : 'Create my login'}</AuthSubmit>
        </form>
        </>
      )}
    </AuthShell>
  )
}
