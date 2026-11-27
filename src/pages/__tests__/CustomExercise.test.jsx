// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: api }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'coach' } }) }))
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }))
import CustomExercise from '../CustomExercise'
let root, host, router, failed, savedPayload
const settle = async () => { await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
async function submit() { await act(async () => document.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))); await settle() }
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
  const Request = globalThis.Request
  vi.stubGlobal('Request', class extends Request { constructor(input, init) { super(input, { ...init, signal: undefined }) } })
  failed = true; savedPayload = null
  api.from.mockImplementation(() => {
    const query = { insert: payload => { savedPayload = payload; return query }, select: () => query, single: () => Promise.resolve(failed ? { error: new Error('Offline') } : { data: { id: 'new-id' } }) }
    return query
  })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  router = createMemoryRouter([{ path: '/plan/exercises/new', element: <CustomExercise /> }, { path: '/plan/exercises', element: <p>Library</p> }], { initialEntries: ['/plan/exercises/new'] })
  await act(async () => root.render(<RouterProvider router={router} />)); await settle()
})
afterEach(async () => { await act(async () => root.unmount()); router.dispose(); host.remove(); vi.unstubAllGlobals() })
it('keeps the complete form after a failed save and returns to the saved entry only after success', async () => {
  const name = document.querySelector('input')
  await act(async () => Simulate.change(name, { target: { value: 'Ring Row' } }))
  const rest = [...document.querySelectorAll('input')].at(-1)
  await act(async () => Simulate.change(rest, { target: { value: '0' } }))
  await submit()
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('Your changes are still here')
  expect(name.value).toBe('Ring Row')
  expect(router.state.location.pathname).toBe('/plan/exercises/new')
  failed = false; await submit()
  expect(savedPayload.default_rest_seconds).toBe(0)
  expect(router.state.location.pathname).toBe('/plan/exercises')
  expect(router.state.location.search).toBe('?exercise=new-id')
})
