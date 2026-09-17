import { test, expect } from '@playwright/test'

const workout = {
  id: 'workout-1', name: 'Lower body power', description: 'Explosive strength session', estimated_duration_minutes: 45,
  created_at: '2026-09-01T12:00:00Z', workout_exercises: [
    { exercise_id: 'exercise-1', exercises: { muscle_group: 'Legs' } },
    { exercise_id: 'exercise-2', exercises: { muscle_group: 'Core' } },
  ], workout_assignments: [{ id: 'assignment-1', expires_at: '2027-01-01T00:00:00Z' }],
}
const athlete = { id: 'athlete-1', full_name: 'Alex Morgan', group_name: 'Performance', level: 'Intermediate', workout_assignments: [{ id: 'assignment-1' }] }
const exercise = { id: 'exercise-1', name: 'Goblet squat', description: 'Controlled squat with a front-loaded weight.', muscle_group: 'Legs', difficulty: 'Medium', category: 'strength', default_sets: 3, default_reps: 10, default_duration_seconds: null, default_rest_seconds: 60, is_custom: false }

async function mockSupabase(page) {
  await page.addInitScript(() => window.localStorage.setItem('chalkup-e2e-auth', 'true'))
  await page.route('https://example.supabase.co/**', async route => {
    const url = new URL(route.request().url())
    let body = []
    if (url.pathname.includes('/workouts')) body = [workout]
    if (url.pathname.includes('/athletes')) body = url.searchParams.get('id') ? athlete : [athlete]
    if (url.pathname.includes('/exercises')) body = [exercise]
    if (url.pathname.includes('/programs')) body = []
    if (url.pathname.includes('/workout_assignments')) body = []
    if (url.pathname.includes('/workout_feedback')) body = []
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) })
  })
}

const routes = [
  ['dashboard', '/dashboard'], ['roster', '/roster'], ['athlete-profile', '/roster/athlete-1'],
  ['workout-editor', '/workout/new'], ['programs', '/programs'], ['program-builder', '/programs/new'],
  ['library', '/library'], ['history', '/history'],
]
const viewports = [
  ['desktop', { width: 1440, height: 960 }], ['tablet', { width: 940, height: 900 }], ['mobile', { width: 375, height: 812 }],
]

test('capture redesigned protected routes at reference viewports', async ({ page }) => {
  await mockSupabase(page)
  for (const [viewportName, viewport] of viewports) {
    await page.setViewportSize(viewport)
    for (const [name, path] of routes) {
      await page.goto(path)
      await expect(page.locator('body')).not.toContainText(/Loading(?:…|\.{3})/)
      await page.waitForTimeout(150)
      await page.screenshot({ path: `artifacts/redesign-screenshots/${name}-${viewportName}.png`, fullPage: true })
    }
  }
})

test('capture public and modal states', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await page.screenshot({ path: 'artifacts/redesign-screenshots/login-mobile.png', fullPage: true })
  await page.goto('/share/not-a-valid-token')
  await expect(page.getByText('Workout not found')).toBeVisible()
  await page.screenshot({ path: 'artifacts/redesign-screenshots/share-invalid-mobile.png', fullPage: true })

  await mockSupabase(page)
  await page.goto('/dashboard')
  await page.getByRole('button', { name: /assign/i }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.screenshot({ path: 'artifacts/redesign-screenshots/assign-modal-mobile.png', fullPage: true })
})
