import { describe, expect, it, vi } from 'vitest';
import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { createApiClient, ApiError, retryRead } from './index';

function unauthorized(config: InternalAxiosRequestConfig) {
  return new AxiosError('Expired', 'ERR_BAD_REQUEST', config, undefined, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {},
    config,
    data: {},
  });
}
describe('JWT renewal', () => {
  it('renews once for concurrent 401s and retries a late old-token response with the new token', async () => {
    let token = 'old';
    let release!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const refresh = vi.fn(async () => {
      await barrier;
      token = 'new';
      return token;
    });
    const expire = vi.fn();
    const client = createApiClient({
      baseURL: 'https://api.test',
      getAccessToken: () => token,
      refresh,
      onSessionExpired: expire,
    });
    const pending: Array<() => void> = [];
    client.defaults.adapter = async (config) => {
      if (config.headers.get('Authorization') === 'Bearer old')
        await new Promise<void>((_resolve, reject) =>
          pending.push(() => reject(unauthorized(config))),
        );
      return { status: 200, statusText: 'OK', config, headers: {}, data: 'ok' };
    };
    const first = client.get('/one'),
      second = client.get('/two'),
      late = client.get('/late');
    await vi.waitFor(() => expect(pending).toHaveLength(3));
    pending[0]!();
    pending[1]!();
    await vi.waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    release();
    await Promise.all([first, second]);
    pending[2]!();
    await expect(late).resolves.toMatchObject({ status: 200 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(expire).not.toHaveBeenCalled();
  });
  it('does not loop when renewal fails', async () => {
    const expire = vi.fn(),
      refresh = vi.fn(async () => {
        throw new ApiError('Session expired', 401);
      });
    const client = createApiClient({
      baseURL: 'https://api.test',
      getAccessToken: () => null,
      refresh,
      onSessionExpired: expire,
    });
    client.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };
    await expect(client.get('/private')).rejects.toMatchObject({ status: 401 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(expire).toHaveBeenCalledTimes(1);
  });
  it('preserves cancellation without renewal', async () => {
    const refresh = vi.fn(),
      expire = vi.fn();
    const controller = new AbortController();
    controller.abort();
    const client = createApiClient({
      baseURL: 'https://api.test',
      getAccessToken: () => null,
      refresh,
      onSessionExpired: expire,
    });
    await expect(client.get('/private', { signal: controller.signal })).rejects.toSatisfy(
      axios.isCancel,
    );
    expect(refresh).not.toHaveBeenCalled();
    expect(expire).not.toHaveBeenCalled();
  });
  it('keeps the session when renewal fails because the service is temporarily offline', async () => {
    const expire = vi.fn();
    const client = createApiClient({
      baseURL: 'https://api.test',
      getAccessToken: () => null,
      refresh: async () => {
        throw new ApiError('Offline', 503);
      },
      onSessionExpired: expire,
    });
    client.defaults.adapter = async (config) => {
      throw unauthorized(config);
    };
    await expect(client.get('/private')).rejects.toMatchObject({ status: 503 });
    expect(expire).not.toHaveBeenCalled();
  });
  it('only retries temporary read failures', () => {
    expect(retryRead(0, new ApiError('', 503))).toBe(true);
    expect(retryRead(0, new ApiError('', 403))).toBe(false);
    expect(retryRead(2, new ApiError('', 0))).toBe(false);
  });
});
