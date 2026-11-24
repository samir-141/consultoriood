import { test, expect } from "@playwright/test";

test.describe("Agente de Bugs - Pruebas de Robustez, Límites y Errores", () => {
  test("No debe haber errores no capturados en consola ni fallos 500 en la navegación pública", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    const start = Date.now();
    const res = await page.goto("/");
    const duration = Date.now() - start;

    expect(res?.status()).toBe(200);
    expect(duration).toBeLessThan(3000); // Tiempo de respuesta bajo 3s
    expect(consoleErrors).toEqual([]);
  });

  test("Rutas inexistentes devuelven 404 correctamente", async ({ page }) => {
    const res = await page.goto("/ruta-inexistente-12345");
    expect(res?.status()).toBe(404);
  });

  test("GET /api/reservas valida parámetros y devuelve horarios ocupados y disponibles", async ({ request }) => {
    const start = Date.now();
    const res = await request.get("/api/reservas?fecha=2026-12-15&servicio=evaluacion");
    const duration = Date.now() - start;

    expect(res.status()).toBe(200);
    expect(duration).toBeLessThan(1000);

    const data = await res.json();
    expect(data).toHaveProperty("fecha", "2026-12-15");
    expect(data).toHaveProperty("horariosDisponibles");
    expect(data).toHaveProperty("horariosOcupados");
    expect(Array.isArray(data.horariosDisponibles)).toBe(true);
    expect(Array.isArray(data.horariosOcupados)).toBe(true);
  });

  test("GET /api/reservas con fecha inválida devuelve 400 y mensaje limpio", async ({ request }) => {
    const res = await request.get("/api/reservas?fecha=fecha-invalida");
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.error).not.toMatch(/SELECT|FROM|pg_|sql/i); // Sin exponer SQL
  });

  test("POST /api/reservas rechaza campos vacíos con código 400", async ({ request }) => {
    const res = await request.post("/api/reservas", {
      data: {},
    });
    expect(res.status()).toBe(400);

    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("POST /api/reservas rechaza teléfono inválido con 400", async ({ request }) => {
    const res = await request.post("/api/reservas", {
      data: {
        date: "2026-12-15",
        time: "10:00",
        name: "Prueba Paciente",
        phone: "12", // muy corto
        serviceId: "evaluacion",
      },
    });
    expect(res.status()).toBe(400);
  });

  test("POST /api/reservas evita doble reserva del mismo horario devolviendo 409", async ({ request }) => {
    // Buscar un día laborable futuro
    const day = "2026-12-16";
    const slotTime = "11:00";
    const payloadA = {
      date: day,
      time: slotTime,
      serviceId: "evaluacion",
      name: "Paciente Concurrente A",
      phone: "966111222",
    };
    const payloadB = {
      date: day,
      time: slotTime,
      serviceId: "evaluacion",
      name: "Paciente Concurrente B",
      phone: "966333444",
    };

    const resA = await request.post("/api/reservas", { data: payloadA });
    // Si resA tuvo éxito (201) o ya estaba ocupado (409)
    if (resA.status() === 201) {
      const resB = await request.post("/api/reservas", { data: payloadB });
      expect(resB.status()).toBe(409);
      const dataB = await resB.json();
      expect(dataB.error).toContain("ocupado");
    } else {
      expect(resA.status()).toBe(409);
    }
  });

  test("GET /api/reservas?mes=YYYY-MM valida el mes, expone minAdvanceMinutes=15 y estado de días", async ({ request }) => {
    const badRes = await request.get("/api/reservas?mes=2026-13");
    expect(badRes.status()).toBe(400);

    const todayLima = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const month = todayLima.slice(0, 7);

    const res = await request.get(`/api/reservas?mes=${month}&servicio=evaluacion`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("minAdvanceMinutes", 15);
    expect(data).toHaveProperty("days");
    expect(data.days).toHaveProperty(todayLima);
    expect(typeof data.days[todayLima].reservable).toBe("boolean");

    // Ningún domingo del mes debe ser reservable
    const sundayEntry = Object.values(data.days).find((d: unknown) => {
      const item = d as { date: string; reservable: boolean; status: string };
      return new Date(`${item.date}T12:00:00Z`).getUTCDay() === 0;
    }) as { date: string; reservable: boolean; status: string } | undefined;
    if (sundayEntry) {
      expect(sundayEntry.reservable).toBe(false);
    }
  });

  test("Regla de 15 min: ningún slot disponible de hoy está dentro de los próximos 15 minutos", async ({ request }) => {
    const now = new Date();
    const todayLima = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);

    const res = await request.get(`/api/reservas?fecha=${todayLima}&servicio=evaluacion`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("minAdvanceMinutes", 15);

    const cutoffMs = now.getTime() + 15 * 60_000;
    for (const time of data.horariosDisponibles as string[]) {
      const slotMs = new Date(`${todayLima}T${time}:00-05:00`).getTime();
      expect(slotMs).toBeGreaterThanOrEqual(cutoffMs - 1000);
    }

    if ((data.horariosDisponibles as string[]).length === 0) {
      expect(data.reservable).toBe(false);
    }
  });
});
