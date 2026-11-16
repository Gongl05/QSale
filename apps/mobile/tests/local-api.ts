import { mobileURL, apiOrigin } from '../../../tests/environment';
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
    if (target.origin !== apiOrigin) return route.abort();
    const cors = {
      'access-control-allow-origin': mobileURL,
      'access-control-allow-headers': 'authorization,content-type',
      'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const headers = { ...req.headers() };
    delete headers.origin;
    delete headers.host;
    const response = await request.fetch(
      apiOrigin + target.pathname + target.search,
      { method: req.method(), headers, data: req.postDataBuffer() ?? undefined },
    );
    await received(target.pathname, req.method(), response);
    await route.fulfill({ response, headers: { ...response.headers(), ...cors } });
  });
}
