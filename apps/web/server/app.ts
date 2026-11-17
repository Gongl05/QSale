import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import type { Tokens } from '@qsale/contracts';

interface Config {
  apiURL: string;
  origin: string;
  production?: boolean;
  dist?: string;
  upstream?: typeof fetch;
}

export function createApp(config: Config) {
  const app = express();
  const upstream = config.upstream ?? fetch;
  const apiURL = config.apiURL.replace(/\/$/, '');
  const cookie = {
    httpOnly: true,
    secure: Boolean(config.production),
    sameSite: 'lax' as const,
    path: '/session',
  };
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(self), geolocation=(self)',
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    if (config.production) res.set('Strict-Transport-Security', 'max-age=31536000');
    next();
  });
  app.use(cookieParser());
  // Profile pictures travel as base64 JSON (the app shrinks them first); every other body stays small.
  app.use('/backend/api/v1/users/me/avatar', express.json({ limit: '2mb' }));
  app.use(express.json({ limit: '64kb' }));
  app.use(['/session', '/backend'], (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin') !== config.origin) {
      res.status(403).json({ message: 'Origen no autorizado.' });
      return;
    }
    next();
  });

  app.post('/session/:action', async (req, res) => {
    const action = req.params.action;
    if (action === 'logout') {
      const refreshToken = req.cookies.qsale_refresh;
      if (refreshToken) {
        try {
          const result = await upstream(apiURL + '/auth/logout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
            signal: AbortSignal.timeout(12_000),
          });
          if (!result.ok && ![400, 401, 403].includes(result.status)) {
            res.status(502).json({ message: 'No pudimos cerrar la sesión. Inténtalo de nuevo.' });
            return;
          }
        } catch {
          res.status(502).json({ message: 'No pudimos cerrar la sesión. Inténtalo de nuevo.' });
          return;
        }
      }
      res.clearCookie('qsale_refresh', cookie).sendStatus(204);
      return;
    }
    if (!['signin', 'signup', 'refresh'].includes(action)) {
      res.sendStatus(404);
      return;
    }
    const body = action === 'refresh' ? { refreshToken: req.cookies.qsale_refresh } : req.body;
    if (action === 'refresh' && !body.refreshToken) {
      res.sendStatus(401);
      return;
    }
    try {
      const result = await upstream(apiURL + '/auth/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(12_000),
      });
      if (!result.ok) {
        if (action === 'refresh' && [400, 401, 403].includes(result.status))
          res.clearCookie('qsale_refresh', cookie);
        res.status(result.status).json({ message: 'No se pudo completar la sesión.' });
        return;
      }
      const tokens = (await result.json()) as Tokens;
      if (typeof tokens.token !== 'string' || typeof tokens.refreshToken !== 'string')
        throw new Error('Invalid token response');
      res.cookie('qsale_refresh', tokens.refreshToken, {
        ...cookie,
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      res.status(result.status).json({ token: tokens.token });
    } catch {
      res.status(502).json({ message: 'No pudimos conectar con el servicio.' });
    }
  });

  app.use('/backend/api/v1', async (req, res) => {
    const abort = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) abort.abort();
    });
    try {
      const relative = req.url;
      if (/^\/auth(?:\/|\?|$)/i.test(decodeURIComponent(relative))) {
        res.sendStatus(404);
        return;
      }
      // The upstream host and API prefix are fixed server-side, including encoded paths.
      const target = new URL(apiURL + relative);
      if (
        /^\/auth(?:\/|$)/i.test(
          decodeURIComponent(target.pathname.slice(new URL(apiURL).pathname.length)),
        )
      ) {
        res.sendStatus(404);
        return;
      }
      if (
        target.origin !== new URL(apiURL).origin ||
        !target.pathname.startsWith(new URL(apiURL).pathname + '/')
      ) {
        res.sendStatus(400);
        return;
      }
      const result = await upstream(target, {
        method: req.method,
        headers: {
          'Content-Type': 'application/json',
          ...(req.get('authorization') ? { Authorization: req.get('authorization')! } : {}),
        },
        ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: JSON.stringify(req.body) }),
        signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12_000)]),
      });
      res.status(result.status);
      if (result.status === 204) {
        res.end();
        return;
      }
      // Profile pictures are the only binary responses; pass the bytes through untouched.
      const type = result.headers.get('content-type') ?? '';
      if (/^image\/(jpeg|png|webp)$/.test(type.split(';')[0].trim())) {
        res.type(type).send(Buffer.from(await result.arrayBuffer()));
        return;
      }
      res.type('application/json').send(await result.text());
    } catch {
      if (!res.destroyed)
        res.status(502).json({ message: 'El servicio no está disponible por el momento.' });
    }
  });
  app.get('/health', (_req, res) => {
    res.json({ status: 'UP' });
  });
  if (config.dist) {
    app.use(express.static(config.dist, { index: false, maxAge: '1h' }));
    app.get('/{*route}', (req, res) => {
      if (req.path.startsWith('/session') || req.path.startsWith('/backend')) {
        res.sendStatus(404);
        return;
      }
      res.set('Cache-Control', 'no-cache').sendFile(path.join(config.dist!, 'index.html'));
    });
  }
  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res
        .status(err instanceof SyntaxError ? 400 : 500)
        .json({ message: 'No se pudo procesar la solicitud.' });
    },
  );
  return app;
}
