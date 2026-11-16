// Separate local test stacks without changing the default CI ports.
export const apiURL = process.env.QSALE_TEST_API_URL ?? 'http://127.0.0.1:19080/api/v1';
export const apiOrigin = new URL(apiURL).origin;
export const webPort = Number(process.env.QSALE_TEST_WEB_PORT ?? 5173);
export const mobilePort = Number(process.env.QSALE_TEST_MOBILE_PORT ?? 8081);
export const sessionPort = Number(process.env.QSALE_TEST_SESSION_PORT ?? 3001);
export const webURL = `http://127.0.0.1:${webPort}`;
export const mobileURL = `http://127.0.0.1:${mobilePort}`;
