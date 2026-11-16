import { expect, test, type Page } from "@playwright/test";
import type { Commitment, PlanDetail } from "@qsale/contracts";

async function controlledAccount(page: Page, closed = false) {
  const user = {
    id: 1,
    name: "Lucía Mendoza",
    email: "lucia@example.test",
    role: "USER",
    createdAt: "2026-11-01T12:00:00",
    location: null,
  };
  const plan: PlanDetail = {
    id: 1,
    version: 1,
    name: "Cena del grupo",
    description: "Decidamos dónde reunirnos.",
    type: "DINNER",
    status: closed ? "CLOSED" : "OPEN",
    feasibilityStatus: "TO_BE_DEFINED",
    feasibilityScore: 65,
    minParticipants: 4,
    agreementVersion: closed ? 1 : 0,
    budget: 40,
    tentativeStartDate: "2026-12-01",
    tentativeEndDate: null,
    creatorName: user.name,
    creatorId: user.id,
    createdAt: user.createdAt,
    currentUserRole: "ORGANIZER",
    currentUserParticipationStatus: "JOINED",
    inviteCode: "A1B2C3D4",
    closedAt: closed ? "2026-11-16T12:00:00" : null,
    agreement: closed
      ? { date: "2026-12-12", time: "19:30:00", place: "Plaza de Barranco" }
      : null,
  };
  let commitment: Commitment = {
    id: 1,
    userId: 1,
    userName: user.name,
    status: "CONFIRMED",
    note: "Llego después de clase",
    respondedAt: user.createdAt,
  };
  const writes: unknown[] = [];
  await page.route("**/session/refresh", (route) =>
    route.fulfill({ json: { token: "controlled-test-session" } }),
  );
  await page.route("**/backend/api/v1/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname.replace(
      "/backend/api/v1",
      "",
    );
    if (pathname === "/users/me") return route.fulfill({ json: user });
    if (pathname === "/plans/1/commitments/me" && request.method() === "PUT") {
      const value = request.postDataJSON();
      writes.push(value);
      commitment = { ...commitment, ...value };
      return route.fulfill({ json: commitment });
    }
    if (pathname === "/plans/1") return route.fulfill({ json: plan });
    if (pathname === "/plans")
      return route.fulfill({
        json: {
          content: [plan],
          page: 0,
          size: 10,
          totalElements: 1,
          totalPages: 1,
        },
      });
    if (pathname === "/plans/1/commitments")
      return route.fulfill({ json: [commitment] });
    if (pathname === "/plans/1/feasibility")
      return route.fulfill({
        json: {
          planId: 1,
          score: 65,
          status: "TO_BE_DEFINED",
          confirmedParticipants: 2,
          minParticipants: 4,
          totalParticipants: 4,
          dateReady: true,
          placeReady: true,
        },
      });
    if (pathname === "/notifications/page")
      return route.fulfill({
        json: {
          content: [],
          page: 0,
          size: 10,
          totalElements: 0,
          totalPages: 0,
          unreadCount: 0,
        },
      });
    if (pathname === "/plans/1/geography")
      return route.fulfill({
        json: { midpoint: null, locatedParticipants: 0, joinedParticipants: 2 },
      });
    return route.fulfill({ json: [] });
  });
  return { writes, plan };
}

test("attendance and its note save explicitly as a single response", async ({
  page,
}) => {
  const { writes } = await controlledAccount(page);
  await page.goto("/plans/1");
  await page
    .getByRole("button", { name: "Editar respuesta", exact: true })
    .click();
  await page.getByRole("radio", { name: "Me interesa", exact: true }).check();
  await page
    .getByLabel("Una nota para tu grupo (opcional)")
    .fill("Confirmo el jueves");
  expect(writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect(page.locator(".own-response")).toHaveText("Me interesa");
  expect(writes).toEqual([
    { status: "INTERESTED", note: "Confirmo el jueves" },
  ]);
  await page.reload();
  await expect(page.locator(".saved-note")).toHaveText("Confirmo el jueves");
});

test("leaving a draft offers continue editing and an explicit discard", async ({
  page,
}) => {
  const { writes } = await controlledAccount(page);
  await page.goto("/plans/1");
  await page
    .getByRole("button", { name: "Editar respuesta", exact: true })
    .click();
  await page
    .getByLabel("Una nota para tu grupo (opcional)")
    .fill("Todavía sin guardar");
  await page
    .getByRole("link", { name: "Mis planes", exact: true })
    .first()
    .click();
  const dialog = page.getByRole("dialog", {
    name: "¿Descartar los cambios sin guardar?",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Volver", exact: true }).click();
  await expect(
    page.getByLabel("Una nota para tu grupo (opcional)"),
  ).toHaveValue("Todavía sin guardar");
  await page
    .getByRole("link", { name: "Mis planes", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Descartar cambios", exact: true })
    .click();
  await expect(page).toHaveURL(/\/plans$/);
  expect(writes).toHaveLength(0);
});

test("a confirmed agreement supersedes the tentative date", async ({
  page,
}) => {
  await controlledAccount(page, true);
  await page.goto("/plans/1");
  const agreement = page.getByRole("region", { name: "Acuerdo vigente" });
  await expect(agreement).toContainText("12 dic.");
  await expect(agreement).toContainText("19:30");
  await expect(agreement).toContainText("Plaza de Barranco");
  await expect(page.locator(".plan-meta")).not.toContainText("1 dic.");
});

test("discarding a proposal keeps another editor's draft and never submits either form", async ({
  page,
}) => {
  const { writes } = await controlledAccount(page);
  await page.goto("/plans/1");
  await page
    .getByRole("button", { name: "Editar respuesta", exact: true })
    .click();
  await page
    .getByLabel("Una nota para tu grupo (opcional)")
    .fill("Guárdame este borrador");
  await page.getByRole("button", { name: "Proponer", exact: true }).click();
  await page
    .getByLabel("Título de la propuesta")
    .fill("Una propuesta pendiente");
  await page
    .getByRole("button", { name: "Cancelar propuesta", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Descartar cambios", exact: true })
    .click();
  await expect(page.getByLabel("Título de la propuesta")).toHaveCount(0);
  await expect(
    page.getByLabel("Una nota para tu grupo (opcional)"),
  ).toHaveValue("Guárdame este borrador");
  expect(writes).toHaveLength(0);
  await page
    .getByRole("link", { name: "Mis planes", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("dialog", { name: "¿Descartar los cambios sin guardar?" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Volver", exact: true })
    .click();
  await expect(page).toHaveURL(/\/plans\/1$/);
});

test("page size stays adjustable after all results fit on one page", async ({
  page,
}) => {
  const { plan } = await controlledAccount(page);
  const plans = Array.from({ length: 11 }, (_, index) => ({
    ...plan,
    id: index + 1,
    name: `Salida ${index + 1}`,
  }));
  await page.route(
    (url) => url.pathname === "/backend/api/v1/plans",
    (route) => {
      const url = new URL(route.request().url());
      const size = Number(url.searchParams.get("size") ?? 10);
      return route.fulfill({
        json: {
          content: plans.slice(0, size),
          page: 0,
          size,
          totalElements: 11,
          totalPages: Math.ceil(11 / size),
        },
      });
    },
  );
  await page.goto("/plans");
  await expect(page.getByRole("article")).toHaveCount(10);
  for (const size of ["25", "50", "100", "10"]) {
    await page.getByLabel("Elementos por página").selectOption(size);
    await expect(page.getByRole("article")).toHaveCount(
      size === "10" ? 10 : 11,
    );
    await expect(page.getByLabel("Elementos por página")).toHaveValue(size);
  }
});

test("the response action precedes proposals on a small screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await controlledAccount(page);
  await page.goto("/plans/1");
  const action = page.getByRole("button", {
    name: "Editar respuesta",
    exact: true,
  });
  await expect(action).toBeVisible();
  const actionBox = await action.boundingBox();
  const proposalsBox = await page
    .getByRole("heading", { name: "Propuestas de fecha y lugar", exact: true })
    .boundingBox();
  expect(actionBox).not.toBeNull();
  expect(proposalsBox).not.toBeNull();
  expect(actionBox!.y).toBeLessThan(proposalsBox!.y);
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(844);
});

test("an unavailable map keeps the proposed locations accessible", async ({
  page,
}) => {
  await controlledAccount(page);
  await page.route("**/backend/api/v1/plans/1/options", (route) =>
    route.fulfill({
      json: [
        {
          id: 7,
          type: "PLACE",
          label: "Parque para encontrarnos",
          location: { latitude: -12.12, longitude: -77.03 },
          voteCount: 1,
          hasVoted: false,
          selected: false,
          proposedByName: "Lucía Mendoza",
          estimateStatus: "PENDING",
        },
      ],
    }),
  );
  await page.route("**/*.tile.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/plans/1?tab=map");
  await expect(page.locator(".map-recovery")).toContainText(
    "consultar las ubicaciones en la lista",
  );
  await page
    .locator("summary")
    .filter({ hasText: "Ver ubicaciones en lista" })
    .click();
  const locations = page.locator(".map-locations");
  await expect(locations).toContainText("Parque para encontrarnos");
  await expect(locations).toContainText("-12.12000, -77.03000");
  await expect(locations.getByRole("link")).toHaveAttribute(
    "href",
    /mlat=-12\.12&mlon=-77\.03/,
  );
});

test("saving a plan leaves its editor without a discard prompt", async ({
  page,
}) => {
  const { plan } = await controlledAccount(page);
  await page.route(
    (url) => url.pathname === "/backend/api/v1/plans",
    (route) => route.fulfill({ status: 201, json: plan }),
  );
  await page.goto("/plans/new");
  await page.getByLabel("¿Cómo se llama el plan?").fill("Cena del grupo");
  await page.getByRole("button", { name: "Crear plan", exact: true }).click();
  await expect(page).toHaveURL(/\/plans\/1$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
