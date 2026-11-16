import { openCoordinates } from "./ui-flows";
import { apiURL } from "../../../tests/environment";
import { test, expect, type Page } from "@playwright/test";

const api = apiURL;
async function account(page: Page) {
  let token = "";
  page.on("request", (request) => {
    if (request.url().includes("/backend/"))
      token = request.headers().authorization ?? token;
  });
  await page.goto("/register");
  await page.getByLabel("Tu nombre").fill("Auditoría de flujos");
  await page
    .getByLabel("Correo electrónico")
    .fill(`flow.${Date.now()}@qsale.test`);
  await page
    .getByLabel("Contraseña", { exact: true })
    .fill("FlowRegression2026");
  await page
    .getByRole("button", { name: "Crear mi cuenta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/plans$/);
  return () => ({ Authorization: token });
}

test("coordinate changes and rapid navigation do not leave map callbacks running; denied GPS has a manual path", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (
          _success: unknown,
          error: (value: object) => void,
        ) => error({ code: 1 }),
      },
    });
  });
  await account(page);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
    await openCoordinates(page);
    await page
      .getByLabel("Latitud", { exact: true })
      .fill(String(-12.1 - attempt / 100));
    await page.getByLabel("Longitud", { exact: true }).fill("-77.03");
    await page
      .getByRole("link", { name: "Mis planes", exact: true })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Descartar cambios", exact: true })
      .click();
  }
  await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
  await page
    .getByRole("button", { name: "Usar mi ubicación", exact: true })
    .click();
  await expect(
    page.getByText(
      "No pudimos acceder a tu ubicación. Revisa el permiso o elige un punto manualmente.",
      { exact: true },
    ),
  ).toBeVisible();
  await openCoordinates(page);
  await page.getByLabel("Latitud", { exact: true }).fill("-12.12");
  await page.getByLabel("Longitud", { exact: true }).fill("-77.03");
  await page
    .getByRole("button", { name: "Guardar mi perfil", exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel("Latitud", { exact: true })).toHaveValue(
    "-12.12",
  );
  expect(errors).toEqual([]);
});

test("recovers from a server error and an offline write needs an explicit retry", async ({
  page,
  request,
}) => {
  const headers = await account(page);
  let fail = true,
    id: number | undefined;
  await page.route(
    (url) =>
      url.pathname.endsWith("/notifications/page") &&
      url.searchParams.get("size") === "10",
    (route) =>
      fail
        ? route.fulfill({
            status: 500,
            contentType: "application/json",
            body: '{"message":"Internal failure"}',
          })
        : route.continue(),
  );
  await page
    .getByRole("link", { name: /^Notificaciones/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "No pudimos cargar esta parte" }),
  ).toBeVisible();
  await expect(page.getByText("Internal failure", { exact: true })).toHaveCount(
    0,
  );
  fail = false;
  await page
    .getByRole("button", { name: "Volver a intentar", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Todo al día" }),
  ).toBeVisible();
  await page.goto("/plans/new");
  await page
    .getByLabel("¿Cómo se llama el plan?")
    .fill("Creación después de recuperar la conexión");
  try {
    await page.context().setOffline(true);
    await expect(
      page.getByRole("status").filter({ hasText: "Estás sin conexión" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Crear plan", exact: true }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "No pudimos conectar" }),
    ).toBeVisible();
    await page.context().setOffline(false);
    await expect(
      page.getByRole("button", { name: "Crear plan", exact: true }),
    ).toBeEnabled();
    await expect(page).toHaveURL(/\/plans\/new$/);
    const empty = await request.get(api + "/plans", { headers: headers() });
    expect((await empty.json()).totalElements).toBe(0);
    await page.getByRole("button", { name: "Crear plan", exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/\d+$/);
    id = Number(new URL(page.url()).pathname.split("/").pop());
  } finally {
    await page.context().setOffline(false);
    if (id) await request.delete(api + "/plans/" + id, { headers: headers() });
  }
});

test("a failed route download has a friendly recovery and preserves the session", async ({
  page,
}) => {
  await account(page);
  await page.route("**/src/pages/Profile.tsx*", (route) =>
    route.abort("failed"),
  );
  await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "No pudimos abrir esta pantalla" }),
  ).toBeVisible();
  await expect(page.getByText("Unexpected Application Error!")).toHaveCount(0);
  await page.unrouteAll({ behavior: "wait" });
  await page
    .getByRole("button", { name: "Volver a cargar", exact: true })
    .click();
  await expect(page.getByLabel("Nombre", { exact: true })).toHaveValue(
    "Auditoría de flujos",
  );
});

test("removing a profile location persists after reload", async ({ page }) => {
  await account(page);
  await page.getByRole("link", { name: "Mi perfil", exact: true }).click();
  await openCoordinates(page);
  await page.getByLabel("Latitud", { exact: true }).fill("-12.12");
  await page.getByLabel("Longitud", { exact: true }).fill("-77.03");
  await page
    .getByRole("button", { name: "Guardar mi perfil", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Tu perfil está actualizado." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Latitud", { exact: true })).toHaveValue(
    "-12.12",
  );
  await page
    .getByRole("button", { name: "Quitar ubicación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar mi perfil", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Tu perfil está actualizado." }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Latitud", { exact: true })).toHaveValue("");
  await expect(page.getByLabel("Longitud", { exact: true })).toHaveValue("");
});

test("refreshing an edit keeps the draft and updates untouched fields", async ({
  page,
  request,
}) => {
  const headers = await account(page);
  const created = await request.post(api + "/plans", {
    headers: headers(),
    data: {
      name: "Plan original",
      type: "DINNER",
      minParticipants: 2,
      budget: 10,
    },
  });
  expect(created.ok()).toBe(true);
  const id = (await created.json()).id;
  try {
    await page.goto(`/plans/${id}/edit`);
    await expect(page.getByLabel("¿Cómo se llama el plan?")).toHaveValue(
      "Plan original",
    );
    await page
      .getByLabel("¿Cómo se llama el plan?")
      .fill("Mi borrador sin guardar");
    const update = await request.put(`${api}/plans/${id}`, {
      headers: headers(),
      data: {
        name: "Cambio de otra sesión",
        type: "DINNER",
        minParticipants: 2,
        budget: 50,
        version: (await created.json()).version,
      },
    });
    expect(update.ok()).toBe(true);
    await page.clock.install();
    await page.clock.runFor(31_000);
    const refreshed = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/backend/api/v1/plans/${id}`) &&
        response.request().method() === "GET",
    );
    await page.evaluate(() =>
      window.dispatchEvent(new Event("visibilitychange")),
    );
    await refreshed;
    await expect(page.getByLabel("¿Cómo se llama el plan?")).toHaveValue(
      "Mi borrador sin guardar",
    );
    await expect(page.getByLabel("Presupuesto estimado (S/)")).toHaveValue(
      "50",
    );
  } finally {
    await request.delete(`${api}/plans/${id}`, { headers: headers() });
  }
});

test("inviting a new email provides a registration path and existing members can reuse the code", async ({
  page,
  request,
}) => {
  const headers = await account(page);
  const created = await request.post(api + "/plans", {
    headers: headers(),
    data: { name: "Invitación recuperable", type: "OTHER", minParticipants: 2 },
  });
  expect(created.ok()).toBe(true);
  const plan = await created.json();
  try {
    await page.goto("/plans/" + plan.id);
    await page.getByRole("button", { name: "El grupo", exact: true }).click();
    await page
      .getByLabel("Invitar por correo")
      .fill(`not.registered.${Date.now()}@qsale.test`);
    await page.getByRole("button", { name: "Invitar", exact: true }).click();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Ese correo aún no tiene cuenta" }),
    ).toBeVisible();
    await page.goto("/join/" + plan.inviteCode);
    await page
      .getByRole("button", { name: "Unirme al plan", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp("/plans/" + plan.id + "$"));
  } finally {
    await request.delete(`${api}/plans/${plan.id}`, { headers: headers() });
  }
});

test("a stale edit preserves its draft and requires review before saving over newer data", async ({
  page,
  request,
}) => {
  const headers = await account(page);
  const created = await request.post(api + "/plans", {
    headers: headers(),
    data: {
      name: "Original draft",
      type: "OTHER",
      minParticipants: 2,
      budget: 10,
    },
  });
  const plan = await created.json();
  try {
    await page.goto(`/plans/${plan.id}/edit`);
    await expect(page.getByLabel("¿Cómo se llama el plan?")).toHaveValue(
      "Original draft",
    );
    await page.getByLabel("¿Cómo se llama el plan?").fill("My preserved draft");
    const updated = await request.put(`${api}/plans/${plan.id}`, {
      headers: headers(),
      data: {
        name: "Changed elsewhere",
        type: "OTHER",
        minParticipants: 2,
        budget: 50,
        version: plan.version,
      },
    });
    expect(updated.status()).toBe(200);
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      "El plan cambió en otra sesión",
    );
    await expect(page.getByLabel("¿Cómo se llama el plan?")).toHaveValue(
      "My preserved draft",
    );
    await expect(page.getByLabel("Presupuesto estimado (S/)")).toHaveValue(
      "50",
    );
    await page
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/plans/${plan.id}$`));
    const saved = await (
      await request.get(`${api}/plans/${plan.id}`, { headers: headers() })
    ).json();
    expect(saved).toMatchObject({ name: "My preserved draft", budget: 50 });
  } finally {
    await request.delete(`${api}/plans/${plan.id}`, { headers: headers() });
  }
});
