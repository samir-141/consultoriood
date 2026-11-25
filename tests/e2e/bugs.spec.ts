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
    // Calentamiento de ruta en modo dev para medir latencia real de la API
    await request.get("/api/reservas?fecha=2026-12-15&servicio=evaluacion");

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

  test("Reserva de 45 min bloquea 2 intervalos de 30 min y bloqueos de doctor anulan reservas del día", async ({ request }) => {
    // 1. Verificar servicio de 45 min en un día futuro despejado (ej. 2026-12-22 martes)
    const cleanDay = "2026-12-22";
    const holdRes = await request.post("/api/reservas", {
      data: {
        date: cleanDay,
        time: "09:00",
        serviceId: "limpieza", // 45 min -> 09:00 a 09:45
        name: "Prueba Intervalos 45m",
        phone: "966555444",
      },
    });
    expect([201, 409]).toContain(holdRes.status());

    if (holdRes.status() === 201) {
      const holdJson = await holdRes.json();
      const dayRes = await request.get(`/api/reservas?fecha=${cleanDay}&servicio=evaluacion`);
      const dayJson = await dayRes.json();
      const i0900 = dayJson.intervalos.find((x: { time: string }) => x.time === "09:00");
      const i0930 = dayJson.intervalos.find((x: { time: string }) => x.time === "09:30");
      const i1000 = dayJson.intervalos.find((x: { time: string }) => x.time === "10:00");
      expect(i0900?.available).toBe(false);
      expect(i0930?.available).toBe(false);
      expect(i1000?.available).toBe(true);

      // Cancelar cita de prueba para dejar limpia la agenda
      await request.post(`/api/reservas/${holdJson.token}`, { data: { action: "cancel" } });
    }

    // 2. Doctor toma día libre completo (2026-12-23 miércoles) -> día deja de ser reservable
    const loginRes = await request.post("/api/sesion", {
      data: { email: "odontologia@demo.test", password: "DemoDental!101" },
    });
    expect(loginRes.status()).toBe(200);

    const blockedDay = "2026-12-23";
    const blockRes = await request.post("/api/panel/agenda", {
      data: {
        action: "block",
        professionalId: "odonto-a",
        date: blockedDay,
        time: "09:00",
        endTime: "17:00",
        reason: "Día libre del profesional",
      },
    });
    expect(blockRes.status()).toBe(200);
    const { id: blockId } = await blockRes.json();

    const blockedMonthRes = await request.get(`/api/reservas?mes=2026-12&servicio=evaluacion`);
    const blockedMonth = await blockedMonthRes.json();
    expect(blockedMonth.days[blockedDay].reservable).toBe(false);
    expect(blockedMonth.days[blockedDay].status).toBe("NO_DOCTORS");

    const attemptRes = await request.post("/api/reservas", {
      data: {
        date: blockedDay,
        time: "10:00",
        serviceId: "evaluacion",
        name: "Paciente En Día Libre",
        phone: "966000111",
      },
    });
    expect(attemptRes.status()).toBe(409);

    // Limpiar bloqueo
    const unblockRes = await request.post("/api/panel/agenda", {
      data: { action: "unblock", blockId },
    });
    expect(unblockRes.status()).toBe(200);
  });
});
