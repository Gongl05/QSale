import { test, expect } from '@playwright/test';

test('notification pagination survives reload, filters and reading the last item', async ({
  page,
  request,
}) => {
  const api = 'http://127.0.0.1:19080/api/v1';
  const stamp = Date.now();
  const password = 'NotificationTest2026';
  const recipientEmail = `notifications.reader.${stamp}@qsale.test`;
  const organizer = await request.post(api + '/auth/signup', {
    data: {
      name: 'Organizador de prueba',
      email: `notifications.owner.${stamp}@qsale.test`,
      password,
    },
  });
  expect(organizer.ok()).toBe(true);
  const ownerHeaders = {
    Authorization: 'Bearer ' + (await organizer.json()).token,
  };
  const recipient = await request.post(api + '/auth/signup', {
    data: { name: 'Lector de prueba', email: recipientEmail, password },
  });
  expect(recipient.ok()).toBe(true);
  const readerHeaders = {
    Authorization: 'Bearer ' + (await recipient.json()).token,
  };
  const plans: number[] = [];
  try {
    for (let index = 0; index < 11; index++) {
      const created = await request.post(api + '/plans', {
        headers: ownerHeaders,
        data: {
          name: `Invitación ${index + 1}`,
          type: 'OTHER',
          minParticipants: 2,
        },
      });
      expect(created.ok()).toBe(true);
      const id = (await created.json()).id as number;
      plans.push(id);
      const invited = await request.post(`${api}/plans/${id}/participants`, {
        headers: ownerHeaders,
        data: { email: recipientEmail },
      });
      expect(invited.ok()).toBe(true);
    }
    await page.goto('/login?returnTo=%2Fnotifications%3Funread%3Dtrue%26size%3D10%26page%3D2');
    await page.getByLabel('Correo electrónico').fill(recipientEmail);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Entrar a QSale' }).click();
    await expect(page).toHaveURL(/\/notifications\?unread=true&size=10&page=2$/);
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByText('11 notificaciones sin leer', { exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('article')).toHaveCount(1);
    await expect(page.getByLabel('Solo sin leer')).toBeChecked();

    await page.getByRole('button', { name: 'Marcar como leída', exact: true }).click();
    await expect(page).toHaveURL(/page=1$/);
    await expect(page.getByRole('article')).toHaveCount(10);
    await expect(page.getByText('10 notificaciones sin leer', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Página siguiente' })).toBeDisabled();

    await page.getByLabel('Solo sin leer').click();
    await expect(page.getByLabel('Solo sin leer')).not.toBeChecked();
    await expect(page.getByRole('button', { name: 'Página siguiente' })).toBeEnabled();
    for (const size of ['25', '50', '100']) {
      await page.getByLabel('Elementos por página').selectOption(size);
      await expect(page.getByRole('article')).toHaveCount(11);
      await expect(page).toHaveURL(new RegExp(`size=${size}`));
    }
    await page.getByLabel('Solo sin leer').click();
    await expect(page.getByLabel('Solo sin leer')).toBeChecked();
    await expect(page.getByRole('article')).toHaveCount(10);
    const unread = await request.get(api + '/notifications/page?unreadOnly=true&size=100', {
      headers: readerHeaders,
    });
    expect(unread.ok()).toBe(true);
    for (const notification of (await unread.json()).content) {
      const read = await request.patch(`${api}/notifications/${notification.id}/read`, {
        headers: readerHeaders,
      });
      expect(read.ok()).toBe(true);
    }
    await page.goto('/notifications?unread=true&size=100&page=99');
    await expect(page).toHaveURL(/page=1$/);
    await expect(page.getByRole('heading', { name: 'Todo al día' })).toBeVisible();
    await expect(page.getByText('0 notificaciones sin leer', { exact: true })).toBeVisible();
    await expect(page.getByRole('article')).toHaveCount(0);
  } finally {
    for (const id of plans) await request.delete(`${api}/plans/${id}`, { headers: ownerHeaders });
  }
});
