import { test, expect } from '@playwright/test';

test('native form can clear the default count, recover validation, enter decimals and save', async ({
  page,
  request,
}) => {
  const email = `number.regression.${Date.now()}@qsale.test`,
    password = 'NumberRegression2026';
  let token: string | undefined, planId: number | undefined;
  // This browser-only bridge tests the actual native form against the local API.
  // It does not replace the physical-device checks of GPS, camera or SecureStore.
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const target = new URL(req.url());
    if (target.port !== '19080') {
      await route.abort();
      return;
    }
    const cors = {
      'access-control-allow-origin': 'http://127.0.0.1:8081',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    };
    if (req.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    const headers = { ...req.headers() };
    delete headers.origin;
    delete headers.host;
    const response = await request.fetch(
      'http://127.0.0.1:19080' + target.pathname + target.search,
      { method: req.method(), headers, data: req.postDataBuffer() ?? undefined },
    );
    if (target.pathname.endsWith('/auth/signup') && response.ok())
      token = (await response.json()).token;
    if (target.pathname === '/api/v1/plans' && req.method() === 'POST' && response.ok())
      planId = (await response.json()).id;
    await route.fulfill({ response, headers: { ...response.headers(), ...cors } });
  });
  try {
    await page.goto('/register');
    await page.getByLabel('Tu nombre').fill('Prueba de formulario');
    await page.getByLabel('Correo electrónico').fill(email);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click();
    await expect(page.getByText('Hagamos que salga.', { exact: true })).toBeVisible();
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
    const budget = page.getByLabel('Presupuesto estimado (S/)');
    await budget.fill('40.');
    await expect(budget).toHaveValue('40.');
    await budget.fill('40,50');
    await expect(budget).toHaveValue('40,50');
    await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/\d+$/);
    expect(planId).toBeDefined();
    const saved = await request.get('http://127.0.0.1:19080/api/v1/plans/' + planId, {
      headers: { Authorization: 'Bearer ' + token },
    });
    expect(await saved.json()).toMatchObject({ minParticipants: 5, budget: 40.5 });
  } finally {
    await page.unrouteAll({ behavior: 'wait' });
    await page.close();
    if (planId && token)
      await request.delete('http://127.0.0.1:19080/api/v1/plans/' + planId, {
        headers: { Authorization: 'Bearer ' + token },
      });
  }
});
