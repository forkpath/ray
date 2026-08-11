import { expect, test } from '@playwright/test'

import { installPlatformProviderMock } from './support/platform-provider-mock'

test.describe('platform critical web flows', () => {
  test('redirects an unauthenticated user to login', async ({ page }) => {
    await installPlatformProviderMock(page)

    await page.goto('/user/profile')

    await expect(page).toHaveURL(/\/auth\/login/)
    await expect(page.getByRole('heading', { name: /Welcome back/ })).toBeVisible()
  })

  test('registers and signs in with deterministic auth provider responses', async ({ page }) => {
    const provider = await installPlatformProviderMock(page)

    await page.goto('/auth/register')
    await page.getByLabel('Email').fill('owner@example.test')
    await page.getByLabel('Password').fill('Password1!')
    await page.getByRole('button', { name: 'Sign up' }).click()

    await expect(page.getByRole('heading', { name: 'Success!' })).toBeVisible()
    expect(provider.requests).toContainEqual(
      expect.objectContaining({ method: 'POST', path: '/api/auth/sign-up/email' })
    )

    await page.goto('/auth/login')
    await page.getByLabel('Email').fill('owner@example.test')
    await page.getByRole('textbox', { name: 'Password' }).fill('Password1!')
    await page.getByRole('button', { name: 'Sign in', exact: true }).click()

    await expect(page).toHaveURL(/\/user\/profile/)
    await expect(page.getByRole('heading', { name: 'Account Settings' })).toBeVisible()
    expect(provider.requests).toContainEqual(
      expect.objectContaining({ method: 'POST', path: '/api/auth/sign-in/email' })
    )
  })

  test('creates and switches organization context through the account UI', async ({ page }) => {
    const provider = await installPlatformProviderMock(page)
    provider.authenticate()

    await page.goto('/user/profile')
    await page.getByRole('button', { name: 'Personal Space' }).click()
    await page.getByText('Create organization', { exact: true }).click()

    const dialog = page.getByRole('dialog', { name: 'Create organization' })
    await dialog.getByLabel(/name/i).fill('Acme Dental')
    await dialog.getByLabel(/slug/i).fill('acme-dental')
    await dialog.getByRole('button', { name: /create/i }).click()

    await expect(page).toHaveURL(/\/crm/)
    expect(provider.requests).toContainEqual({
      method: 'POST',
      path: '/api/auth/organization/create',
      body: expect.objectContaining({ name: 'Acme Dental', slug: 'acme-dental' })
    })
  })

  test('uses owner-scoped billing endpoints and enforces organization permission denial', async ({ page }) => {
    const provider = await installPlatformProviderMock(page)
    provider.authenticate()

    await page.goto('/user/billing')
    await expect(page.getByRole('main').getByText('Free', { exact: true })).toBeVisible()
    await page.evaluate(async () => {
      await fetch('/api/v1/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          variantId: 'premium-monthly',
          successUrl: window.location.href,
          cancelUrl: window.location.href
        })
      })
    })

    expect(provider.requests).toContainEqual(expect.objectContaining({ method: 'GET', path: '/api/v1/billing/me' }))
    const checkout = provider.requests.find(
      request => request.method === 'POST' && request.path === '/api/v1/billing/checkout'
    )
    expect(checkout?.body).toEqual(
      expect.objectContaining({
        variantId: expect.any(String),
        successUrl: expect.stringContaining('/user/billing'),
        cancelUrl: expect.stringContaining('/user/billing')
      })
    )
    expect(checkout?.body).not.toEqual(expect.objectContaining({ ownerId: expect.anything() }))

    provider.setOrganizationRole('member')
    const response = await page.evaluate(async () => {
      const request = await fetch('/api/v1/organizations/org-e2e-1/billing/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          variantId: 'premium-monthly',
          successUrl: 'http://127.0.0.1:4300/user/billing',
          cancelUrl: 'http://127.0.0.1:4300/user/billing'
        })
      })
      return { status: request.status, body: await request.json() }
    })

    expect(response).toEqual({
      status: 403,
      body: { code: 'FORBIDDEN', message: 'Owner or admin required' }
    })
  })
})
