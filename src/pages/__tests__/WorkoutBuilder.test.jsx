// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: api }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'coach' } }) }))
vi.mock('../../lib/exerciseMedia', () => ({ hydrateExerciseMedia: async rows => rows }))
vi.mock('../../components/ExerciseMedia', () => ({ default: () => null }))
vi.mock('../../components/AIGeneratorModal', () => ({ default: () => null }))
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }))
import WorkoutBuilder from '../WorkoutBuilder'

const strength = { id: 'bridge', name: 'Glute Bridge', category: 'strength', muscle_group: 'Legs', default_sets: 3, default_reps: 10, default_rest_seconds: 30 }
const prehab = { ...strength, id: 'cat', name: 'Cat Cow', category: 'prehab' }
let root, host, router, failExercises, exerciseRows, existing
const settle = async () => { await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)) }) }
const button = name => [...document.querySelectorAll('button')].find(el => el.textContent === name || el.getAttribute('aria-label') === name)
async function click(el) { expect(el).toBeTruthy(); await act(async () => el.click()); await settle() }
async function mount(path) {
  router = createMemoryRouter([{ path: '/plan/workouts/new', element: <WorkoutBuilder /> }, { path: '/plan/workouts/:id/edit', element: <WorkoutBuilder /> }, { path: '/plan/workouts', element: <p>Workout list</p> }], { initialEntries: [path] })
  await act(async () => root.render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>))
  await settle()
}
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // Undici's Request rejects jsdom's AbortSignal; these routes have no loaders.
  const Request = globalThis.Request
  vi.stubGlobal('Request', class extends Request { constructor(input, init) { super(input, { ...init, signal: undefined }) } })
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
  HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('button')?.focus() }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  failExercises = false; exerciseRows = [strength, prehab]; existing = null
  api.from.mockImplementation(table => {
    const query = { select: () => query, or: () => query, order: () => query, eq: () => query, single: () => query, abortSignal: () => query,
      then: (resolve, reject) => Promise.resolve(table === 'exercises' ? (failExercises ? { error: new Error('Offline') } : { data: exerciseRows }) : { data: existing }).then(resolve, reject) }
    return query
  })
  api.rpc.mockResolvedValue({ data: 'saved-workout' })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); router?.dispose(); host.remove(); sessionStorage.clear(); vi.clearAllMocks(); vi.unstubAllGlobals() })

describe('workout handoff and navigation protection', () => {
  it('adds the selected strength exercise and requires a deliberate discard before leaving', async () => {
    await mount('/plan/workouts/new?exercise=bridge')
    expect(document.body.textContent).toContain('1 exercises · 0 prehab')
    expect(document.body.textContent).toContain('Glute Bridge added')
    await click(button('Cancel'))
    expect(document.querySelector('dialog')?.textContent).toContain('Leave without saving?')
    await click(button('Keep editing'))
    expect(router.state.location.pathname).toBe('/plan/workouts/new')
    await click(button('Cancel')); await click(button('Discard changes'))
    expect(router.state.location.pathname).toBe('/plan/workouts')
  })
  it('places a prehab handoff in prehab instead of main exercises', async () => {
    await mount('/plan/workouts/new?exercise=cat')
    expect(document.body.textContent).toContain('0 exercises · 1 prehab')
  })
  it('does not duplicate an exercise already in an existing workout', async () => {
    existing = { id: 'existing', name: 'Leg day', workout_exercises: [{ exercises: strength, sets: 3, reps: 10, rest_seconds: 30, position: 0 }], workout_prehab: [] }
    await mount('/plan/workouts/existing/edit?exercise=bridge')
    expect(document.body.textContent).toContain('already in this workout')
    expect(document.body.textContent).toContain('1 exercises · 0 prehab')
    await click(button('Cancel'))
    expect(router.state.location.pathname).toBe('/plan/workouts')
  })
  it('offers Retry for a failed handoff load and applies the exercise only after success', async () => {
    failExercises = true
    await mount('/plan/workouts/new?exercise=bridge')
    expect(document.body.textContent).toContain('Couldn’t load selected exercise')
    expect(document.body.textContent).not.toContain('Glute Bridge added')
    failExercises = false
    await click(button('Retry'))
    expect(document.body.textContent).toContain('Glute Bridge added')
  })
  it('never exposes an editable empty form when an existing workout fails to load', async () => {
    await mount('/plan/workouts/missing/edit')
    expect(document.body.textContent).toContain('Couldn’t load workout')
    expect(document.querySelector('input[aria-label="Workout name"]')).toBeNull()
  })
  it('keeps edits made during a save dirty and preserves a zero rest interval', async () => {
    exerciseRows = [{ ...strength, default_rest_seconds: 0 }]
    await mount('/plan/workouts/new?exercise=bridge')
    const input = document.querySelector('input[aria-label="Workout name"]')
    await act(async () => Simulate.change(input, { target: { value: 'Original name' } }))
    let finish
    api.rpc.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await click(button('Save workout'))
    await act(async () => Simulate.change(input, { target: { value: 'Newer edits' } }))
    await act(async () => finish({ data: 'saved-workout' })); await settle()
    expect(api.rpc.mock.calls[0][1].p_exercises[0].rest_seconds).toBe(0)
    expect(document.body.textContent).toContain('Save again to keep your latest edits')
    await click(button('Cancel'))
    expect(document.querySelector('dialog')?.textContent).toContain('Leave without saving?')
  })
})
