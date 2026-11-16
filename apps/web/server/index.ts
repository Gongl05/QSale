import { fileURLToPath } from 'node:url';
import { createApp } from './app.ts';

const production = process.env.NODE_ENV === 'production';
const origin = process.env.APP_ORIGIN ?? 'http://127.0.0.1:5173';
if (production && (!process.env.APP_ORIGIN || !origin.startsWith('https://')))
  throw new Error('APP_ORIGIN must be the HTTPS web origin.');
const app = createApp({
  apiURL: process.env.API_URL ?? 'http://127.0.0.1:19080/api/v1',
  origin,
  production,
  csrfSecret: process.env.CSRF_SECRET,
  trustedProxy: process.env.TRUSTED_PROXY ?? 'loopback',
  ...(production ? { dist: fileURLToPath(new URL('../dist', import.meta.url)) } : {}),
});
app.listen(Number(process.env.PORT ?? 3001), '0.0.0.0', () => {
  console.log('QSale web ready');
});
