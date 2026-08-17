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
