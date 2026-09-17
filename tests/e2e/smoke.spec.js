import { expect, test } from '@playwright/test'

test('login and password recovery controls render', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeVisible()
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.getByRole('button', { name: 'Email reset link' })).toBeVisible()
})

test('protected routes redirect to login without a session', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/\/login$/)
})

test('invalid assignment links fail closed', async ({ page }) => {
  await page.goto('/share/not-a-valid-assignment-token')
  await expect(page.getByText('Workout not found')).toBeVisible()
})

test('authentication remains usable at the mobile reference width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/login')
  await page.getByRole('tab', { name: 'Sign up' }).click()
  await expect(page.getByLabel('Full name')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Create account →' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)
  expect(overflow).toBe(false)
})

test('removed AI generation is not exposed on public entry points', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByText(/anthropic|ai generator|generate with ai/i)).toHaveCount(0)
})
