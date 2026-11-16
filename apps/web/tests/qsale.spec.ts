import { apiURL } from '../../../tests/environment';
import { test, expect, type Page } from '@playwright/test';

const stamp = Date.now();
const emailA = `web.ana.${stamp}@qsale.test`,
  emailB = `web.bob.${stamp}@qsale.test`;
const password = 'FrontendTest2026';
const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
let planId: number;
let tokenA: string;
let paginationToken: string;
const paginationEmail = `web.pagination.${stamp}@qsale.test`;
const extraPlans: number[] = [];
async function register(page: Page, name: string, email: string) {
  await page.goto('/register');
  await page.getByLabel('Tu nombre').fill(name);
  await page.getByLabel('Correo electrónico').fill(email);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Crear mi cuenta' }).click();
  await expect(page).toHaveURL(/\/plans$/);
}

test('two people organize, vote, confirm and close a plan through the real API', async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await register(page, 'Ana del grupo', emailA);
  const session = await request.post(apiURL + '/auth/signin', {
    data: { email: emailA, password },
  });
  tokenA = (await session.json()).token;
  await page.getByRole('link', { name: 'Crear plan', exact: true }).click();
  await page.getByLabel('¿Cómo se llama el plan?').fill('Reencuentro del sábado');
  await page.getByLabel('Cuéntales la idea').fill('Una tarde para conversar y ponernos al día.');
  await page.getByLabel('Presupuesto estimado (S/)').fill('60');
  await page.getByRole('button', { name: 'Crear plan', exact: true }).click();
  await expect(page).toHaveURL(/\/plans\/\d+$/);
  planId = Number(new URL(page.url()).pathname.split('/').pop());
  await page.getByRole('button', { name: 'El grupo' }).click();
  await page.getByLabel('Invitar por correo').fill(emailB);
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await register(bob, 'Bruno del grupo', emailB);
  await page.getByRole('button', { name: 'Invitar', exact: true }).click();
  await expect(page.getByText('Invitación pendiente', { exact: true })).toBeVisible();
  await bob.reload();
  await bob.getByRole('link', { name: 'Reencuentro del sábado', exact: true }).click();
  await bob.getByRole('button', { name: 'Aceptar invitación' }).click();
  await expect(bob.getByRole('button', { name: 'Sí, voy' })).toBeEnabled();
  await page.getByRole('button', { name: 'Propuestas', exact: true }).click();
  await page.getByRole('button', { name: 'Proponer', exact: true }).click();
  await page.getByLabel('Título de la propuesta').fill('Sábado al atardecer');
  await page.getByLabel('Día de inicio', { exact: true }).fill(futureDate);
  await page.getByLabel('Hora de inicio (Lima, opcional)').fill('17:00');
  await page.getByRole('button', { name: 'Publicar propuesta' }).click();
  await page.getByRole('button', { name: 'Votar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Quitar mi voto' })).toBeVisible();
  await bob.reload();
  await bob.getByRole('button', { name: 'Votar', exact: true }).click();
  await bob.getByRole('button', { name: 'Sí, voy' }).click();
  await page.getByRole('button', { name: 'Proponer', exact: true }).click();
  await page.getByRole('button', { name: 'Lugar', exact: true }).click();
  await page.getByLabel('Título de la propuesta').fill('Parque para reencontrarnos');
  await page.getByLabel('Latitud', { exact: true }).fill('-12.12');
  await page.getByLabel('Longitud', { exact: true }).fill('-77.03');
  await page.getByRole('button', { name: 'Publicar propuesta' }).click();
  await page.getByRole('button', { name: 'Votar', exact: true }).click();
  await bob.reload();
  await bob.getByRole('button', { name: 'Votar', exact: true }).click();
  await page.getByLabel('Una nota para tu grupo (opcional)').fill('Llego después de clase');
  await page.getByRole('button', { name: 'Sí, voy' }).click();
  await expect(page.getByText('Tu nota guardada: Llego después de clase')).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Una nota para tu grupo (opcional)')).toHaveValue(
    'Llego después de clase',
  );
  await page.getByRole('button', { name: 'Me interesa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Me interesa', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByLabel('Una nota para tu grupo (opcional)')).toHaveValue(
    'Llego después de clase',
  );
  await page.getByRole('button', { name: 'Sí, voy' }).click();
  await expect(page.getByRole('button', { name: 'Confirmar y cerrar plan' })).toBeEnabled();
  await page.getByRole('button', { name: 'Disponibilidad' }).click();
  await page.getByLabel('Día', { exact: true }).fill(futureDate);
  await page.getByRole('button', { name: 'Añadir disponibilidad' }).click();
  await expect(page.getByText('Todo el día', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Propuestas', exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath('plan-detail-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Confirmar y cerrar plan' }).click();
  await page.getByRole('button', { name: 'Confirmar plan', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Acuerdo vigente', exact: true })).toBeVisible();
  await expect(page.getByText('Elegida', { exact: true })).toHaveCount(2);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Reencuentro del sábado', exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    })),
  ).toEqual({ local: [], session: [] });
  const cookies = await page.context().cookies();
  const refresh = cookies.find((cookie) => cookie.name === 'qsale_refresh');
  expect(refresh?.httpOnly).toBe(true);
  await page
    .getByRole('link', { name: /^Notificaciones/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: 'Lo último de tu grupo' })).toBeVisible();
  await page.getByRole('link', { name: 'Mi perfil', exact: true }).click();
  await page.getByLabel('Dirección o referencia (opcional)').fill('Parque cercano');
  await expect(page.getByRole('button', { name: 'Guardar mi perfil' })).toBeDisabled();
  await page.getByLabel('Latitud', { exact: true }).fill('-12.12');
  await expect(page.getByRole('button', { name: 'Guardar mi perfil' })).toBeDisabled();
  await page.getByLabel('Longitud', { exact: true }).fill('-77.03');
  await expect(page.getByRole('button', { name: 'Guardar mi perfil' })).toBeEnabled();
  await page.getByLabel('Nombre', { exact: true }).fill('Ana actualizada');
  const profileSaved = page.waitForResponse(response =>
    response.url().endsWith('/backend/api/v1/users/me') &&
    response.request().method() === 'PUT' && response.ok(),
  );
  await page.getByRole('button', { name: 'Guardar mi perfil' }).click();
  await profileSaved;
  await page.reload();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Ana actualizada');
  await bobContext.close();
  expect(errors).toEqual([]);
});

test('server pagination, URL filters, mobile layout and protected navigation', async ({
  page,
  request,
}, testInfo) => {
  const registered = await request.post(apiURL + '/auth/signup', {
    data: {name:'Pagination reader',email:paginationEmail,password},
  });
  expect(registered.status()).toBe(201);
  paginationToken = (await registered.json()).token;
  for (const [index, name] of [
    'Ruta por Barranco',
    'Pichanga del domingo',
    'Noche de películas',
    'Tarde de estudio',
    'Cumple de Vale',
    'Un café pendiente',
    'Museo con el grupo',
    'Almuerzo de reencuentro',
    'Escapada a Cieneguilla',
    'Cena de fin de ciclo',
    'Caminata frente al mar',
  ].entries()) {
    const result = await request.post(apiURL + '/plans', {
      headers: { Authorization: 'Bearer ' + paginationToken },
      data: {
        name,
        type: [
          'TRIP',
          'SPORTS',
          'CULTURAL',
          'STUDY',
          'PARTY',
          'DINNER',
          'CULTURAL',
          'DINNER',
          'TRIP',
          'DINNER',
          'OTHER',
        ][index],
        minParticipants: 4,
        budget: 30 + index * 10,
      },
    });
    expect(result.ok()).toBe(true);
    extraPlans.push((await result.json()).id);
  }
  await page.goto('/plans?size=10');
  await expect(page).toHaveURL(/\/login\?returnTo=/);
  await page.getByLabel('Correo electrónico').fill(paginationEmail);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar a QSale' }).click();
  await expect(page.getByRole('article')).toHaveCount(10);
  await page.getByRole('button', { name: 'Página siguiente' }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole('article')).toHaveCount(1);
  await page.getByLabel('Buscar planes por nombre o descripción').fill('Barranco');
  await expect(page.getByRole('article')).toHaveCount(1);
  await expect(page).toHaveURL(/search=Barranco/);
  await page.getByLabel('Buscar planes por nombre o descripción').fill('');
  await expect(page.getByRole('article')).toHaveCount(10);
  await page.getByLabel('Elementos por página').selectOption('25');
  await expect(page.getByRole('article')).toHaveCount(11);
  await page.screenshot({ path: testInfo.outputPath('plans-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.locator('.sidebar').evaluate((element) => element.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({ path: testInfo.outputPath('plans-mobile.png'), fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.sidebar')).toHaveAttribute('inert', '');
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await expect(page.getByRole('dialog', { name: 'Menú principal' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Abrir menú' })).toBeFocused();
  await page.getByRole('button', { name: 'Abrir menú' }).click();
  await page.getByRole('link', { name: 'Mi perfil', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tu punto de partida' })).toBeVisible();
  await page.goto('/admin');
  await expect(page.getByText('Solo los administradores pueden ver esta pantalla.')).toBeVisible();
  await page.goto('/esta-pagina-no-existe');
  await expect(page.getByRole('heading', { name: 'Este camino no lleva a un plan' })).toBeVisible();
});
test.afterAll(async ({ request }) => {
  if (paginationToken)
    for (const id of extraPlans)
      await request.delete(apiURL + '/plans/' + id, {
        headers: { Authorization: 'Bearer ' + paginationToken },
      });
  if (tokenA && planId) await request.delete(apiURL + '/plans/' + planId, {
    headers: { Authorization: 'Bearer ' + tokenA },
  });
});
