import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/session/refresh', route => route.fulfill({ status: 401, json: {} }));
});

test('request recovery keeps a generic response for the supplied email', async ({ page }) => {
  let requested = '';
  await page.route('**/session/password-reset-request', route => {
    requested = route.request().postDataJSON().email;
    return route.fulfill({ status: 202, json: {} });
  });
  await page.goto('/forgot-password');
  await page.getByLabel('Correo electrónico', { exact: true }).fill('persona@example.test');
  await page.getByRole('button', { name: 'Enviar enlace', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Si el correo tiene una cuenta' })).toBeVisible();
  expect(requested).toBe('persona@example.test');
});

test('reset removes the token from the URL and validates confirmation before sending', async ({ page }) => {
  const writes: unknown[] = [];
  await page.route('**/session/password-reset-confirm', route => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ status: 204 });
  });
  await page.goto('/reset-password?token=controlled-test-token');
  await expect(page).toHaveURL(/\/reset-password$/);
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer');
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('NuevaClave2026');
  await page.getByLabel('Repite la contraseña', { exact: true }).fill('OtraClave2026');
  await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Las contraseñas no coinciden');
  expect(writes).toHaveLength(0);
  await page.getByLabel('Repite la contraseña', { exact: true }).fill('NuevaClave2026');
  await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Tu contraseña se actualizó' })).toBeVisible();
  expect(writes).toEqual([{ token: 'controlled-test-token', password: 'NuevaClave2026' }]);
  await expect(page.getByRole('link', { name: 'Volver a iniciar sesión', exact: true })).toHaveAttribute('href', '/login');
});

test('expired and missing links have a working path to request another', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByRole('alert')).toContainText('El enlace está incompleto');
  await page.getByRole('link', { name: 'Solicitar otro enlace', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Recuperar contraseña', exact: true })).toBeVisible();
  await page.route('**/session/password-reset-confirm', route => route.fulfill({ status: 400, json: {} }));
  await page.goto('/reset-password?token=expired-test-token');
  await page.getByLabel('Nueva contraseña', { exact: true }).fill('NuevaClave2026');
  await page.getByLabel('Repite la contraseña', { exact: true }).fill('NuevaClave2026');
  await page.getByRole('button', { name: 'Guardar nueva contraseña', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('El enlace venció o ya se usó');
  await expect(page.getByRole('link', { name: 'Solicitar otro enlace', exact: true })).toHaveAttribute('href', '/forgot-password');
});
