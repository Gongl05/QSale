import {
  openOptionalFields,
  openCoordinates,
  saveAttendance,
  openPlanManagement,
} from "./ui-flows";
import { apiURL, mobileURL } from "../../../tests/environment";
import {
  test,
  expect as baseExpect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import { localApiBridge } from "../../mobile/tests/local-api";

const expect = baseExpect.configure({ timeout: 12_000 });
const endpoint = apiURL;
const password = "CoordinationTest2026";
const future = (offset: number) =>
  new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
async function account(request: APIRequestContext, name: string) {
  const email = `coord.${Date.now()}.${Math.random().toString(36).slice(2)}@qsale.test`;
  const result = await request.post(endpoint + "/auth/signup", {
    data: { name, email, password },
  });
  expect(result.status()).toBe(201);
  return { email, token: (await result.json()).token as string };
}
async function login(page: Page, email: string, mobile = false) {
  await page.goto((mobile ? mobileURL : "") + "/login");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Entrar a QSale", exact: true })
    .click();
}

test("desktop and mobile share an agreement, late attendance and finite rescheduling without reconfirmation loops", async ({
  page,
  browser,
  request,
}, testInfo) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(12_000);
  const owner = await account(request, "Organizador web");
  const guest = await account(request, "Integrante móvil");
  const third = await account(request, "Tercer integrante");
  const headers = { Authorization: "Bearer " + owner.token };
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobile = await mobileContext.newPage();
  mobile.setDefaultTimeout(12_000);
  mobile.setDefaultNavigationTimeout(60_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push("web: " + error.message));
  mobile.on("pageerror", (error) => errors.push("mobile: " + error.message));
  await localApiBridge(mobile, request, async () => {});
  let planId: number | undefined;
  try {
    await login(page, owner.email);
    await page.getByRole("link", { name: "Crear plan", exact: true }).click();
    await page
      .getByLabel("¿Cómo se llama el plan?")
      .fill("Acuerdo entre web y móvil");
    await page.getByRole("button", { name: "Crear plan", exact: true }).click();
    await expect(page).toHaveURL(/\/plans\/\d+$/);
    planId = Number(new URL(page.url()).pathname.split("/").pop());
    const plan = await (
      await request.get(endpoint + "/plans/" + planId, { headers })
    ).json();
    expect(plan.budget).toBeNull();
    await login(mobile, guest.email, true);
    await mobile
      .getByRole("button", { name: "Unirme con código", exact: true })
      .click();
    await mobile.getByLabel("Código de invitación").fill(plan.inviteCode);
    await mobile
      .getByRole("button", { name: "Unirme al plan", exact: true })
      .click();
    await expect(mobile).toHaveURL(new RegExp("/plans/" + planId + "$"));
    expect(
      (
        await request.post(endpoint + "/plans/join/" + plan.inviteCode, {
          headers: { Authorization: "Bearer " + third.token },
        })
      ).ok(),
    ).toBe(true);

    // The mobile form proposes only a day; the application must not invent midnight.
    await mobile.getByRole("button", { name: "Proponer", exact: true }).click();
    await mobile
      .getByLabel("Título de la propuesta")
      .fill("Día elegido desde el móvil");
    await mobile.getByLabel("Día de inicio (AAAA-MM-DD)").fill(future(20));
    await mobile
      .getByRole("button", { name: "Publicar propuesta", exact: true })
      .click();
    await expect(mobile).toHaveURL(new RegExp("/plans/" + planId + "$"));
    await expect(mobile.getByText(/Hora por acordar/).first()).toBeVisible();
    await mobile.getByRole("button", { name: "Votar", exact: true }).click();
    await expect(
      mobile.getByRole("button", {
        name: "Votaste · Quitar voto",
        exact: true,
      }),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Día elegido desde el móvil" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Votar", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Votaste · Quitar voto", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Proponer", exact: true }).click();
    await page.getByRole("button", { name: "Lugar", exact: true }).click();
    await page.getByLabel("Título de la propuesta").fill("Parque del acuerdo");
    await openCoordinates(page);
    await page.getByLabel("Latitud", { exact: true }).fill("-12.12");
    await page.getByLabel("Longitud", { exact: true }).fill("-77.03");
    await page
      .getByRole("button", { name: "Publicar propuesta", exact: true })
      .click();
    await page
      .getByRole("article")
      .filter({
        has: page.getByRole("heading", {
          name: "Parque del acuerdo",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Votar", exact: true })
      .click();
    await expect(
      mobile.getByText("Parque del acuerdo", { exact: true }),
    ).toBeVisible();
    await mobile.getByRole("button", { name: "Votar", exact: true }).click();
    await saveAttendance(mobile, "CONFIRMED", undefined, true);
    await saveAttendance(page, "CONFIRMED");
    // Optional availability must not gate a sufficiently agreed plan: with 3 members add signals.
    await page
      .getByRole("button", { name: "Disponibilidad", exact: true })
      .click();
    await openOptionalFields(page, "Añadir mi disponibilidad");
    await page.getByLabel("Día", { exact: true }).fill(future(20));
    await page
      .getByRole("button", { name: "Añadir disponibilidad", exact: true })
      .click();
    await mobile
      .getByRole("tab", { name: "Disponibilidad", exact: true })
      .click();
    await mobile
      .getByLabel("Día (AAAA-MM-DD)", { exact: true })
      .fill(future(20));
    await mobile
      .getByRole("button", { name: "Añadir disponibilidad", exact: true })
      .click();
    await expect(page.getByText(/2 de 3 disponibles/)).toBeVisible();
    await expect(
      mobile.getByText(/1 sin disponibilidad registrada/),
    ).toBeVisible();
    await openPlanManagement(page);
    await expect(
      page.getByRole("button", { name: "Confirmar y cerrar plan" }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Confirmar y cerrar plan" }).click();
    await page
      .getByRole("button", { name: "Confirmar plan", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Acuerdo vigente", exact: true }),
    ).toBeVisible();
    await expect(
      mobile.getByText("Acuerdo vigente", { exact: true }),
    ).toBeVisible();
    await saveAttendance(mobile, "CANT_GO", "Ya no alcanzo a llegar", true);
    await expect(
      page.getByText("1 asistente confirmado · Mínimo 2", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "El grupo", exact: true }).click();
    await expect(
      page.getByText("Nota: Ya no alcanzo a llegar", { exact: true }),
    ).toBeVisible();
    let stored = await (
      await request.get(endpoint + "/plans/" + planId, { headers })
    ).json();
    expect(stored).toMatchObject({
      status: "CLOSED",
      agreementVersion: 1,
      tentativeStartDate: future(20),
    });

    // A member can request a different day without changing the original agreement.
    await mobile.getByRole("tab", { name: "Propuestas", exact: true }).click();
    await mobile
      .getByRole("button", { name: "Proponer reprogramación", exact: true })
      .click();
    await mobile.getByLabel("Nuevo día (AAAA-MM-DD)").fill(future(21));
    await mobile
      .getByRole("button", { name: "Publicar reprogramación", exact: true })
      .click();
    await page.getByRole("button", { name: "Propuestas", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Sí, asistiría con este cambio",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "No me funciona", exact: true })
      .click();
    const proposals = await (
      await request.get(endpoint + "/plans/" + planId + "/reschedules", {
        headers,
      })
    ).json();
    expect(
      (
        await request.put(
          endpoint +
            "/plans/" +
            planId +
            "/reschedules/" +
            proposals[0].id +
            "/vote",
          {
            headers: { Authorization: "Bearer " + third.token },
            data: { accepted: false },
          },
        )
      ).ok(),
    ).toBe(true);
    await expect(mobile.getByText("Rechazada", { exact: true })).toBeVisible();
    stored = await (
      await request.get(endpoint + "/plans/" + planId, { headers })
    ).json();
    expect(stored.agreementVersion).toBe(1);

    // This time the organizer proposes and the member's conditional YES is the final attendance.
    await page
      .getByRole("button", { name: "Proponer reprogramación", exact: true })
      .click();
    await page.getByLabel("Nuevo día", { exact: true }).fill(future(22));
    await page
      .getByRole("button", { name: "Publicar reprogramación", exact: true })
      .click();
    await expect(
      mobile.getByRole("button", {
        name: "Sí, asistiría con este cambio",
        exact: true,
      }),
    ).toBeVisible();
    await mobile
      .getByRole("button", {
        name: "Sí, asistiría con este cambio",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Aplicar reprogramación", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Aplicar reprogramación", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Aplicar cambio", exact: true })
      .click();
    await expect(mobile.getByText("Aplicada", { exact: true })).toBeVisible();
    await expect(
      mobile.getByText("2 de 2 confirmaciones mínimas", { exact: true }),
    ).toBeVisible();
    stored = await (
      await request.get(endpoint + "/plans/" + planId, { headers })
    ).json();
    expect(stored).toMatchObject({
      status: "CLOSED",
      agreementVersion: 2,
      tentativeStartDate: future(22),
    });
    await saveAttendance(mobile, "CANT_GO", undefined, true);
    await saveAttendance(mobile, "CONFIRMED", undefined, true);
    await expect(
      mobile.getByText("2 de 2 confirmaciones mínimas", { exact: true }),
    ).toBeVisible();
    expect(
      (
        await (
          await request.get(endpoint + "/plans/" + planId, { headers })
        ).json()
      ).agreementVersion,
    ).toBe(2);
    await page.screenshot({
      path: testInfo.outputPath("coordination-desktop.png"),
      fullPage: true,
    });
    await mobile.screenshot({
      path: testInfo.outputPath("coordination-mobile.png"),
      fullPage: true,
    });
    expect(
      await mobile.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await openPlanManagement(page);
    await page
      .getByRole("button", {
        name: "Reabrir para decidir de nuevo",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", { name: "Reabrir plan", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Confirmar y cerrar plan" }),
    ).toBeDisabled();
    await expect(
      mobile.getByRole("button", { name: "Proponer", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Cancelar plan", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Cancelar plan", exact: true })
      .click();
    await expect(
      mobile.getByRole("button", { name: /^(Responder|Cambiar respuesta)$/ }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    await mobile.unrouteAll({ behavior: "wait" });
    await mobileContext.close();
    if (planId)
      expect(
        (
          await request.delete(endpoint + "/plans/" + planId, { headers })
        ).status(),
      ).toBe(204);
  }
});

test("the mobile organizer can edit, confirm, apply a new place, withdraw, cancel and delete", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120_000);
  const owner = await account(request, "Organizador móvil");
  const guest = await account(request, "Integrante web");
  const headers = { Authorization: "Bearer " + owner.token };
  const guestHeaders = { Authorization: "Bearer " + guest.token };
  const result = await request.post(endpoint + "/plans", {
    headers,
    data: {
      name: "Plan organizado desde el móvil",
      type: "OTHER",
      minParticipants: 2,
    },
  });
  expect(result.status()).toBe(201);
  const plan = await result.json();
  const id = plan.id as number;
  expect(
    (
      await request.post(endpoint + "/plans/join/" + plan.inviteCode, {
        headers: guestHeaders,
      })
    ).ok(),
  ).toBe(true);
  for (const input of [
    { type: "DATE", label: "Día inicial", startsOn: future(24) },
    {
      type: "PLACE",
      label: "Lugar inicial",
      location: { latitude: -12.1, longitude: -77 },
    },
  ]) {
    const optionResult = await request.post(
      endpoint + "/plans/" + id + "/options",
      {
        headers,
        data: input,
      },
    );
    expect(optionResult.status()).toBe(201);
    const option = await optionResult.json();
    for (const identity of [headers, guestHeaders])
      expect(
        (
          await request.post(endpoint + "/options/" + option.id + "/votes", {
            headers: identity,
          })
        ).ok(),
      ).toBe(true);
  }
  for (const identity of [headers, guestHeaders])
    expect(
      (
        await request.put(endpoint + "/plans/" + id + "/commitments/me", {
          headers: identity,
          data: { status: "CONFIRMED" },
        })
      ).ok(),
    ).toBe(true);
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobile = await context.newPage();
  mobile.setDefaultTimeout(12_000);
  mobile.setDefaultNavigationTimeout(60_000);
  await localApiBridge(mobile, request, async () => {});
  try {
    await login(mobile, owner.email, true);
    await mobile
      .getByRole("button", {
        name: /^Ver Plan organizado desde el móvil,/,
      })
      .click();
    await mobile.getByRole("button", { name: "Editar", exact: true }).click();
    await mobile
      .getByLabel("¿Cómo se llama el plan?")
      .fill("Plan móvil editado");
    await mobile
      .getByRole("button", { name: "Guardar cambios", exact: true })
      .click();
    await expect(mobile).toHaveURL(new RegExp("/plans/" + id + "$"));
    mobile.once("dialog", (dialog) => dialog.accept());
    await mobile
      .getByRole("button", { name: "Confirmar y cerrar plan", exact: true })
      .click();
    await expect(
      mobile.getByText("Acuerdo vigente", { exact: true }),
    ).toBeVisible();
    await login(page, guest.email);
    await page
      .getByRole("link", { name: "Plan móvil editado", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Proponer reprogramación", exact: true })
      .click();
    await page.getByLabel("Nuevo día", { exact: true }).fill(future(25));
    await page.getByLabel("Nueva hora (Lima, opcional)").fill("18:30");
    await page
      .getByLabel("Lugar propuesto", { exact: true })
      .selectOption("new");
    await page
      .getByLabel("Nombre del nuevo lugar")
      .fill("Otro lugar compartido");
    await openCoordinates(page);
    await page.getByLabel("Latitud", { exact: true }).fill("-12.2");
    await page.getByLabel("Longitud", { exact: true }).fill("-77.1");
    await page
      .getByRole("button", { name: "Publicar reprogramación", exact: true })
      .click();
    await expect(
      mobile.getByRole("button", {
        name: "Sí, asistiría con este cambio",
        exact: true,
      }),
    ).toBeVisible();
    await mobile
      .getByRole("button", {
        name: "Sí, asistiría con este cambio",
        exact: true,
      })
      .click();
    mobile.once("dialog", (dialog) => dialog.accept());
    await mobile
      .getByRole("button", { name: "Aplicar reprogramación", exact: true })
      .click();
    await expect(page.getByText("Aplicada", { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Acuerdo vigente", exact: true })
        .getByText("Otro lugar compartido", { exact: true }),
    ).toBeVisible();
    expect(
      (await (await request.get(endpoint + "/plans/" + id, { headers })).json())
        .agreementVersion,
    ).toBe(2);

    await mobile
      .getByRole("button", { name: "Proponer reprogramación", exact: true })
      .click();
    await mobile.getByLabel("Nuevo día (AAAA-MM-DD)").fill(future(26));
    await mobile
      .getByRole("button", { name: "Publicar reprogramación", exact: true })
      .click();
    mobile.once("dialog", (dialog) => dialog.accept());
    await mobile
      .getByRole("button", { name: "Retirar reprogramación", exact: true })
      .click();
    await expect(page.getByText("Retirada", { exact: true })).toBeVisible();
    mobile.once("dialog", (dialog) => dialog.accept());
    await mobile
      .getByRole("button", { name: "Cancelar plan", exact: true })
      .click();
    await expect(
      mobile.getByRole("button", { name: /^(Responder|Cambiar respuesta)$/ }),
    ).toHaveCount(0);
    mobile.once("dialog", (dialog) => dialog.accept());
    await mobile
      .getByRole("button", { name: "Eliminar plan", exact: true })
      .click();
    await expect(
      mobile.getByRole("heading", { name: "Mis planes", exact: true }).last(),
    ).toBeVisible();
    expect(
      (await request.get(endpoint + "/plans/" + id, { headers })).status(),
    ).toBe(404);
    await page
      .getByRole("link", { name: "Mis planes", exact: true })
      .first()
      .click();
    await expect(
      page.getByRole("link", { name: "Plan móvil editado", exact: true }),
    ).toHaveCount(0);
  } finally {
    await mobile.unrouteAll({ behavior: "wait" });
    await context.close();
    await request.delete(endpoint + "/plans/" + id, { headers });
  }
});
