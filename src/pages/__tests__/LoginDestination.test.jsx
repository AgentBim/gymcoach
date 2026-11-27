// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ signIn: vi.fn(), google: vi.fn(), getSession: vi.fn(), from: vi.fn() }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ signIn: auth.signIn, signUp: vi.fn() }) }))
vi.mock('../../lib/oauth', () => ({ signInWithGoogle: auth.google, googleErrorMessage: error => error.message }))
vi.mock('../../lib/supabase', () => ({ AUTH_LINK_ERROR: null, supabase: { from: auth.from, auth: { getSession: auth.getSession, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } }))
import Login from '../Login'
import AuthCallback from '../AuthCallback'
let root, host, router
const destination = '/plan/exercises?category=prehab&q=cat'
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) }) }
async function mount(path) {
  router = createMemoryRouter([{ path: '/login', element: <Login /> }, { path: '/auth/callback', element: <AuthCallback /> }, { path: '/plan/exercises', element: <p>Exercise library</p> }], { initialEntries: [path] })
  await act(async () => root.render(<RouterProvider router={router} />)); await settle()
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
  const Request = globalThis.Request
  vi.stubGlobal('Request', class extends Request { constructor(input, init) { super(input, { ...init, signal: undefined }) } })
  auth.signIn.mockResolvedValue({ error: null }); auth.google.mockResolvedValue({ error: null })
  auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'coach' } } } })
  auth.from.mockImplementation(table => { const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === 'coaches' ? { id: 'coach' } : null }) }; return query })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); router?.dispose(); host.remove(); vi.clearAllMocks(); vi.unstubAllGlobals() })
it('returns a successful password login to the requested library view', async () => {
  await mount('/login?next=' + encodeURIComponent(destination))
  const inputs = document.querySelectorAll('input')
  await act(async () => { Simulate.change(inputs[0], { target: { value: 'coach@example.com' } }); Simulate.change(inputs[1], { target: { value: 'test-only' } }) })
  await act(async () => document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); await settle()
  expect(router.state.location.pathname + router.state.location.search).toBe(destination)
})
it('carries the validated destination into Google login', async () => {
  await mount('/login?next=' + encodeURIComponent(destination))
  const google = [...document.querySelectorAll('button')].find(e => e.textContent.includes('Continue with Google'))
  await act(async () => google.click())
  expect(auth.google).toHaveBeenCalledWith('/auth/callback?role=coach&next=' + encodeURIComponent(destination))
})
it('returns a verified coach from the Google callback to the requested view', async () => {
  await mount('/auth/callback?role=coach&next=' + encodeURIComponent(destination))
  expect(router.state.location.pathname + router.state.location.search).toBe(destination)
})
