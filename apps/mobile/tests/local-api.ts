import type { APIRequestContext, APIResponse, Page } from '@playwright/test';

// Browser-only bridge; hardware permissions and SecureStore require a real device.
export async function localApiBridge(
  page: Page,
  request: APIRequestContext,
  received: (path: string, method: string, response: APIResponse) => Promise<void>,
) {
  await page.route('**/api/v1/**', async (route) => {
    const req = route.request();
    const target = new URL(req.url());
    if (target.port !== '19080') return route.abort();
    const cors = {
      'access-control-allow-origin': 'http://127.0.0.1:8081',
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const headers = { ...req.headers() };
    delete headers.origin;
    delete headers.host;
    const response = await request.fetch(
      'http://127.0.0.1:19080' + target.pathname + target.search,
      { method: req.method(), headers, data: req.postDataBuffer() ?? undefined },
    );
    await received(target.pathname, req.method(), response);
    await route.fulfill({ response, headers: { ...response.headers(), ...cors } });
  });
}
