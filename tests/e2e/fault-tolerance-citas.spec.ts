import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

function nextWeekday(daysAhead: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  if (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function nextSunday() {
  const d = new Date();
  const delta = (7 - d.getUTCDay()) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

test.describe("Intentos de fallo, vulnerabilidades y robustez en flujo de citas", () => {
  test("UI /reservar: validaciones estrictas de cliente, fechas bloqueadas, XSS neutralizado y estado legible", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto("/reservar?servicio=evaluacion&servicio=limpieza");
    await expect(page.locator("h2:has-text('Horarios para el')")).toBeVisible({ timeout: 10000 });

    // Verificar bloqueo de fecha no reservable (domingo ingresado manualmente)
    const sunday = nextSunday();
    await expect(page.locator(`button[disabled][aria-label*='domingo']`)).toBeVisible();
    await page.locator("#calendar-date-input").fill(sunday);
    await expect(page.locator("text=/no tiene horarios web disponibles|no es reservable/i").first()).toBeVisible({ timeout: 5000 });

    // Elegir fecha válida y horario libre
    const validDay = nextWeekday(6);
    await page.locator("#calendar-date-input").fill(validDay);
    const slotBtn = page.locator("button:has-text('Disponible')").first();
    await expect(slotBtn).toBeVisible({ timeout: 10000 });
    await slotBtn.click();
    await page.getByRole("button", { name: /completar mis datos/i }).click();

    // Intento de fallo 1: teléfono de 6 dígitos y correo inválido
    await page.locator("#patient-name").fill("Paciente Test");
    await page.locator("#patient-phone").fill("123456");
    await page.locator("#patient-email").fill("correo-invalido");
    await page.getByRole("button", { name: /confirmar reserva/i }).click();

    await expect(page.locator("#patient-phone")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#patient-email")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("h1")).toContainText("Paso 2");

    // Intento de fallo 2: payload XSS en nombre y motivo no se ejecuta y muestra etiqueta legible
    const xssPayload = "<img src=x onerror=\"window.__xss=true\">";
    await page.locator("#patient-name").fill(`María ${xssPayload}`);
    await page.locator("#patient-phone").fill("966777888");
    await page.locator("#patient-email").fill("");
    await page.locator("#patient-reason").fill(xssPayload);
    await page.getByRole("button", { name: /confirmar reserva/i }).click();

    await expect(page.locator("h1")).toContainText("¡Tu cita ha sido confirmada!", { timeout: 10000 });
    await expect(page.locator("dd", { hasText: /^Confirmada$/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Confirmar cita ahora/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Copiar enlace de mi cita/i })).toBeVisible();
    const xssExecuted = await page.evaluate(() => Boolean((window as unknown as { __xss?: boolean }).__xss));
    expect(xssExecuted).toBe(false);
    expect(consoleErrors).toEqual([]);

    // Limpiar reserva creada cancelándola desde el enlace /mi-cita/[token]
    const manageHref = await page.locator("a[href^='/mi-cita/']").getAttribute("href");
    expect(manageHref).toBeTruthy();
    const token = manageHref!.split("/mi-cita/")[1];
    await page.request.post(`/api/reservas/${token}`, { data: { action: "cancel" } });
  });

  test("Seguridad y fallos de API en /api/reservas, /api/reservas/[token] y /api/reniec", async ({ request }) => {
    // 1. CSRF / Origin cruzado rechazado con 403
    const crossSiteRes = await request.post("/api/reservas", {
      headers: { Origin: "https://evil.example.test", "Content-Type": "application/json" },
      data: { date: nextWeekday(4), time: "10:00", name: "CSRF", phone: "966000111" },
    });
    expect(crossSiteRes.status()).toBe(403);

    // 2. Content-Type inválido (415) y cuerpo sobredimensionado (413)
    const wrongTypeRes = await request.post("/api/reservas", {
      headers: { "Content-Type": "text/plain" },
      data: "hola",
    });
    expect(wrongTypeRes.status()).toBe(415);

    const tooLargeRes = await request.post("/api/reservas", {
      data: { padding: "x".repeat(260 * 1024) },
    });
    expect(tooLargeRes.status()).toBe(413);

    // 3. Tokens manipulados o con SQLi -> 404 limpio
    for (const badToken of ["corto", "a".repeat(63) + "g", "' OR 1=1 --", "f".repeat(64)]) {
      const res = await request.get(`/api/reservas/${encodeURIComponent(badToken)}`);
      expect(res.status()).toBe(404);
      const body = await res.json();
      expect(body.error).not.toMatch(/SQL|SELECT|PGlite/i);
    }

    // 4. Reglas de fechas imposibles / domingos / servicios inexistentes
    expect((await request.get(`/api/disponibilidad?date=${nextSunday()}&serviceId=evaluacion`)).status()).toBe(200);
    const sundaySlots = await (await request.get(`/api/disponibilidad?date=${nextSunday()}&serviceId=evaluacion`)).json();
    expect(sundaySlots.slots).toEqual([]);

    expect(
      (await request.post("/api/reservas", {
        data: { date: nextSunday(), time: "10:00", serviceId: "evaluacion", name: "Domingo Test", phone: "966000222" },
      })).status(),
    ).toBe(409);

    expect(
      (await request.post("/api/reservas", {
        data: { date: nextWeekday(5), time: "10:00", serviceId: "inexistente", name: "Servicio Mal", phone: "966000222" },
      })).status(),
    ).toBe(400);

    // 5. Concurrencia exacta + idempotencia + minimización PII + transición inválida tras cancelar
    const targetDay = nextWeekday(7);
    const disp = await (await request.get(`/api/disponibilidad?date=${targetDay}&serviceId=evaluacion`)).json();
    const chosen = disp.slots[0];
    expect(chosen).toBeTruthy();

    const idemKey = randomUUID();
    const basePayload = {
      date: chosen.date,
      time: chosen.time,
      serviceId: "evaluacion",
      professionalId: chosen.professionalId,
      name: "Paciente Concurrencia",
      phone: "966555333",
      dni: "45678912",
      reason: "Dolor molar confidencial",
    };

    const [raceA, raceB] = await Promise.all([
      request.post("/api/reservas", { headers: { "Idempotency-Key": idemKey }, data: basePayload }),
      request.post("/api/reservas", { headers: { "Idempotency-Key": randomUUID() }, data: { ...basePayload, name: "Competidor" } }),
    ]);
    const statuses = [raceA.status(), raceB.status()].sort();
    expect(statuses).toEqual([201, 409]);

    const winnerRes = raceA.status() === 201 ? raceA : raceB;
    const winnerJson = await winnerRes.json();

    try {
      // Idempotencia con misma clave + payload cambiado debe fallar 409 si ganó raceA
      if (raceA.status() === 201) {
        const conflictIdem = await request.post("/api/reservas", {
          headers: { "Idempotency-Key": idemKey },
          data: { ...basePayload, serviceId: "limpieza" },
        });
        expect(conflictIdem.status()).toBe(409);
      }

      // Endpoint público /api/reservas/[token] NO debe filtrar DNI ni motivo clínico ni teléfono
      const publicGet = await request.get(`/api/reservas/${winnerJson.token}`);
      expect(publicGet.status()).toBe(200);
      const publicData = await publicGet.json();
      expect(publicData.appointment).not.toHaveProperty("dni");
      expect(publicData.appointment).not.toHaveProperty("reason");
      expect(publicData.appointment).not.toHaveProperty("patientPhone");
      expect(publicData.appointment).not.toHaveProperty("patientId");

      // Cancelar cita y probar intentos inválidos posteriores (confirm / reschedule -> 409, acción desconocida -> 400)
      const cancelRes = await request.post(`/api/reservas/${winnerJson.token}`, { data: { action: "cancel" } });
      expect(cancelRes.status()).toBe(200);

      expect((await request.post(`/api/reservas/${winnerJson.token}`, { data: { action: "confirm" } })).status()).toBe(409);
      expect(
        (await request.post(`/api/reservas/${winnerJson.token}`, {
          data: { action: "reschedule", date: chosen.date, time: chosen.time },
        })).status(),
      ).toBe(409);
      expect((await request.post(`/api/reservas/${winnerJson.token}`, { data: { action: "hack" } })).status()).toBe(400);
    } finally {
      await request.post(`/api/reservas/${winnerJson.token}`, { data: { action: "cancel" } });
    }

    // 6. Rate-limit aislado por IP en /api/reniec (no bloquea a toda la clínica)
    expect((await request.get("/api/reniec?dni=123")).status()).toBe(400);
    const attackerIp = "203.0.113.77";
    let saw429 = false;
    for (let i = 0; i < 22; i += 1) {
      const r = await request.get("/api/reniec?dni=00000001", { headers: { "x-forwarded-for": attackerIp } });
      if (r.status() === 429) {
        saw429 = true;
        break;
      }
    }
    expect(saw429).toBe(true);

    const normalUser = await request.get("/api/reniec?dni=00000001", { headers: { "x-forwarded-for": "198.51.100.25" } });
    expect(normalUser.status()).toBe(200);
  });
});
