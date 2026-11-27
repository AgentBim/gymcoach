// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
const api = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: api }))
vi.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'coach' } }) }))
vi.mock('../../lib/exerciseMedia', () => ({ hydrateExerciseMedia: async rows => rows }))
vi.mock('../../components/ExerciseMedia', () => ({ default: () => null }))
vi.mock('../../components/Layout', () => ({ default: ({ children }) => <main>{children}</main> }))
import Library from '../Library'
import PlanTabs from '../../components/PlanTabs'
let root, host, router
const settle = async () => { await act(async () => { await new Promise(r => setTimeout(r, 0)) }) }
const button = name => [...document.querySelectorAll('button')].find(e => e.textContent === name || e.getAttribute('aria-label') === name)
async function click(el) { expect(el).toBeTruthy(); await act(async () => el.click()); await settle() }
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
  HTMLDialogElement.prototype.showModal = function () { this.open = true; this.querySelector('button')?.focus() }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  const Request = globalThis.Request
  vi.stubGlobal('Request', class extends Request { constructor(input, init) { super(input, { ...init, signal: undefined }) } })
  api.from.mockImplementation(table => {
    const data = table === 'exercises' ? [{ id: 'bridge', name: 'Bridge', category: 'strength', muscle_group: 'Legs', difficulty: 'Easy', default_sets: 3, default_reps: 10 }] : table === 'workouts' ? [{ id: 'existing', name: 'Leg day' }] : []
    const query = { select: () => query, or: () => query, eq: () => query, is: () => query, order: () => query, abortSignal: () => query, then: (resolve, reject) => Promise.resolve({ data }).then(resolve, reject) }
    return query
  })
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
  router = createMemoryRouter([{ path: '/plan/exercises', element: <Library /> }, { path: '/plan/workouts', element: <><PlanTabs /><p>Workouts</p></> }, { path: '/plan/workouts/new', element: <p>New builder</p> }, { path: '/plan/workouts/:id/edit', element: <p>Existing builder</p> }], { initialEntries: ['/plan/exercises?category=strength&group=Legs&q=Bridge&exercise=bridge'] })
  await act(async () => root.render(<React.StrictMode><RouterProvider router={router} /></React.StrictMode>)); await settle()
})
afterEach(async () => { await act(async () => root.unmount()); router.dispose(); host.remove(); sessionStorage.clear(); vi.unstubAllGlobals() })

it('restores filters and selection through Plan navigation and allows explicit dialog closing', async () => {
  expect(document.querySelector('dialog')?.getAttribute('aria-label')).toBe('Exercise')
  await click(button('Close Exercise'))
  expect(router.state.location.search).not.toContain('exercise=')
  await click(document.querySelector('a[href="/plan/workouts"]'))
  const exercisesLink = [...document.querySelectorAll('a')].find(e => e.textContent === 'Exercises')
  expect(exercisesLink.getAttribute('href')).toContain('q=Bridge')
  await click(exercisesLink)
  expect(document.querySelector('input[aria-label="Search exercises"]').value).toBe('Bridge')
})
it('offers both a new workout and an existing workout with the selected exercise id', async () => {
  await click(button('Add to a workout'))
  expect(button('Create a new workout')).toBeTruthy()
  await click(button('Leg day'))
  expect(router.state.location.pathname).toBe('/plan/workouts/existing/edit')
  expect(router.state.location.search).toBe('?exercise=bridge')
})
it('explains the empty mobility section and clears all filters in one action', async () => {
  await click(button('Close Exercise'))
  await click(button('Mobility 0'))
  expect(document.body.textContent).toContain('Mobility is coming soon')
  await click(button('Clear filters'))
  expect(router.state.location.search).toBe('')
  expect(document.querySelector('input').value).toBe('')
})
