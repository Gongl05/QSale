import { expect, type Page } from "@playwright/test";

export async function openOptionalFields(page: Page, label: string) {
  const summary = page.locator("summary").filter({ hasText: label }).first();
  if (
    !(await summary.evaluate((element) =>
      element.parentElement?.hasAttribute("open"),
    ))
  ) {
    await summary.click();
  }
}

export async function openCoordinates(page: Page) {
  const latitude = page.getByLabel("Latitud", { exact: true });
  if (!(await latitude.isVisible()))
    await openOptionalFields(page, "Ingresar coordenadas manualmente");
}

export async function editAttendance(page: Page) {
  if (
    !(await page
      .getByRole("button", { name: "Guardar respuesta", exact: true })
      .isVisible())
  ) {
    await page
      .getByRole("button", {
        name: /^(Editar respuesta|Responder si voy|Cambiar respuesta|Responder)$/,
      })
      .click();
  }
}

export async function saveAttendance(
  page: Page,
  status: "CONFIRMED" | "INTERESTED" | "CANT_GO",
  note?: string,
  mobile = false,
) {
  await editAttendance(page);
  const label =
    status === "CONFIRMED"
      ? "Sí, voy"
      : status === "INTERESTED"
        ? "Me interesa"
        : mobile
          ? "No puedo"
          : "No puedo asistir";
  await page.getByRole("radio", { name: label, exact: true }).click();
  if (note !== undefined)
    await page
      .getByLabel(
        mobile
          ? "Nota para el grupo (opcional)"
          : "Una nota para tu grupo (opcional)",
        { exact: true },
      )
      .fill(note);
  await page
    .getByRole("button", { name: "Guardar respuesta", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Guardar respuesta", exact: true }),
  ).toHaveCount(0);
}

export async function openPlanManagement(page: Page) {
  await openOptionalFields(page, "Gestionar el plan");
}
