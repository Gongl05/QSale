import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test, expect } from '@playwright/test';
import { buildMapDocument } from '../src/map-document';

test('the native map document reports a failed provider script without a blank or broken page', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://unpkg.com/**', (route) => route.abort('failed'));
  await page.setContent(buildMapDocument([], null, true));
  await expect(page.getByRole('status')).toHaveText(
    'No pudimos cargar el mapa. Revisa tu conexión; igual puedes buscar la dirección.',
  );
  expect(errors).toEqual([]);
});

test('the native map document reports unavailable tiles and keeps labels as plain text', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const leaflet = await readFile(
    resolve(__dirname, '../../../node_modules/leaflet/dist/leaflet.js'),
    'utf8',
  );
  await page.route('https://unpkg.com/**', (route) =>
    route.request().url().endsWith('leaflet.js')
      ? route.fulfill({ contentType: 'application/javascript', body: leaflet })
      : route.fulfill({ contentType: 'text/css', body: '' }),
  );
  await page.route('https://*.tile.openstreetmap.org/**', (route) => route.abort('failed'));
  await page.setContent(
    buildMapDocument(
      [
        {
          latitude: -12,
          longitude: -77,
          label: '</script><script>throw new Error("unsafe label")</script>',
        },
      ],
      null,
      false,
    ),
  );
  await expect(page.getByRole('status')).toHaveText(
    'No pudimos cargar el mapa. Revisa tu conexión; igual puedes buscar la dirección.',
  );
  expect(errors).toEqual([]);
});
