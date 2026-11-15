import { test, expect } from '@playwright/test';
import { localApiBridge } from './local-api';

test('native proposal returns to the plan and cancellation prevents further contributions', async ({
  page,
  request,
}) => {
  page.setDefaultTimeout(10_000);
  const email = `native.flow.${Date.now()}@qsale.test`;
  let token = '',
    planId: number | undefined;
  await localApiBridge(page, request, async (path, method, response) => {
    if (path.endsWith('/auth/signup') && response.ok()) token = (await response.json()).token;
    if (path === '/api/v1/plans' && method === 'POST' && response.ok())
      planId = (await response.json()).id;
  });
  try {
    await page.goto('/register');
    await page.getByLabel('Tu nombre').fill('Auditoría móvil');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill('NativeFlow2026');
    await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
    await page.getByLabel('¿Cómo se llama el plan?').fill('Auditoría de propuestas nativas');
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/\d+$/);
    await page.getByRole('button', { name: 'Proponer', exact: true }).click();
    await page.getByRole('tab', { name: 'Lugar', exact: true }).click();
    await page.getByLabel('Título de la propuesta').fill('Parque de prueba');
    await page.getByLabel('Latitud', { exact: true }).fill('-12.12');
    await page.getByLabel('Longitud', { exact: true }).fill('-77.03');
    await page.getByRole('button', { name: 'Publicar propuesta', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/plans/' + planId + '$'));
    await expect(page.getByText('Parque de prueba', { exact: true })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Cancelar plan', exact: true }).click();
    await expect(
      page.getByText('El plan se canceló. Puedes consultar lo que organizaron.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Proponer', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sí, voy', exact: true })).toHaveCount(0);
    await page.goto('/plans/' + planId + '/proposal');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill('NativeFlow2026');
    await page.getByRole('button', { name: 'Entrar a QSale', exact: true }).click();
    await expect(
      page.getByText('El plan ya está cerrado o cancelado. Puedes consultar sus propuestas.', {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Publicar propuesta', exact: true })).toHaveCount(
      0,
    );
    await page.getByRole('button', { name: 'Ver plan', exact: true }).click();
    await expect(page).toHaveURL(new RegExp('/plans/' + planId + '$'));
  } finally {
    if (!page.isClosed()) await page.unrouteAll({ behavior: 'wait' });
    if (!page.isClosed()) await page.close();
    if (planId && token)
      await request.delete('http://127.0.0.1:19080/api/v1/plans/' + planId, {
        headers: { Authorization: 'Bearer ' + token },
      });
  }
});
