import { apiURL } from '../../../tests/environment';
import { test, expect } from '@playwright/test';
import { localApiBridge } from './local-api';

test('native form can clear the default count, recover validation, enter decimals and save', async ({
  page,
  request,
}) => {
  const email = `number.regression.${Date.now()}@qsale.test`,
    password = 'NumberRegression2026';
  let token: string | undefined, planId: number | undefined;
  await localApiBridge(page, request, async (path, method, response) => {
    if (path.endsWith('/auth/signup') && response.ok()) token = (await response.json()).token;
    if (path === '/api/v1/plans' && method === 'POST' && response.ok())
      planId = (await response.json()).id;
  });
  try {
    await page.goto('/register');
    await page.getByLabel('Tu nombre').fill('Prueba de formulario');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Mis planes', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
    await page.getByLabel('¿Cómo se llama el plan?').fill('Regresión de campos numéricos');
    const count = page.getByLabel('Mínimo de personas');
    await expect(count).toHaveValue('2');
    await count.fill('');
    await expect(count).toHaveValue('');
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
    await expect(
      page.getByText('Escribe un número entero entre 2 y 100.', { exact: true }),
    ).toBeVisible();
    await count.fill('1');
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
    await expect(page.getByText('El mínimo es dos personas.', { exact: true })).toBeVisible();
    await count.fill('5');
    await expect(count).toHaveValue('5');
    await page.getByRole('button', { name: 'Presupuesto y fechas (opcional)', exact: true }).click();
    const budget = page.getByLabel('Presupuesto estimado (S/)');
    await budget.fill('40.');
    await expect(budget).toHaveValue('40.');
    await budget.fill('40,50');
    await expect(budget).toHaveValue('40,50');
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/\d+$/);
    expect(planId).toBeDefined();
    const saved = await request.get(apiURL + '/plans/' + planId, {
      headers: { Authorization: 'Bearer ' + token },
    });
    expect(await saved.json()).toMatchObject({ minParticipants: 5, budget: 40.5 });
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await page.close();
    if (planId && token)
      await request.delete(apiURL + '/plans/' + planId, {
        headers: { Authorization: 'Bearer ' + token },
      });
  }
});
