import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Read before createClient(): the client parses and may clear the URL hash
// on init, and the "/" -> "/dashboard" -> "/login" redirects drop it anyway.
// Supabase appends e.g. #error=access_denied&error_code=otp_expired when an
// email link was already used or has expired.
const hashParams = new URLSearchParams(window.location.hash.slice(1))
export const AUTH_LINK_ERROR = hashParams.get('error_code') || hashParams.get('error') || null

export const supabase = createClient(url, key)
