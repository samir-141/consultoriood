import { test, expect } from "@playwright/test";

test.describe("Auditoría integral de enlaces DB, permisos por rol, tabla Admin/Recepción y parámetros", () => {
  test("Aislamiento de odontólogo: no ve leads PENDING/unassigned ni falla al abrir /panel/clinica con ID ajeno", async ({ page, request }) => {
    const day = "2026-12-29"; // Martes laborable futuro
    // Buscar dinámicamente un horario libre para evitar 409 en reintentos
    const dispRes = await request.get(`/api/disponibilidad?date=${day}&serviceId=evaluacion&professionalId=odonto-a`);
    expect(dispRes.status()).toBe(200);
    const dispJson = await dispRes.json();
    const freeSlot = dispJson.slots[0];
    expect(freeSlot).toBeTruthy();

    // 1. Reserva web pendiente sin confirmar para odonto-a
    const holdRes = await request.post("/api/reservas", {
      data: {
        date: day,
        time: freeSlot.time,
        serviceId: "evaluacion",
        professionalId: "odonto-a",
        name: "Lead Pendiente Sin Confirmar",
        phone: "955111222",
      },
    });
    expect(holdRes.status()).toBe(201);
    const holdJson = await holdRes.json();

    try {
      // Iniciar sesión como Odontólogo (odonto-a)
      const docContext = page.context();
      const loginDoc = await docContext.request.post("/api/sesion", {
        data: { email: "odontologia@demo.test", password: "DemoDental!101" },
      });
      expect(loginDoc.status()).toBe(200);

      // El odontólogo NO debe ver la reserva PENDING/unassigned en su agenda
      const agendaDocRes = await docContext.request.get(`/api/panel/agenda?date=${day}&days=1`);
      expect(agendaDocRes.status()).toBe(200);
      const agendaDoc = await agendaDocRes.json();
      expect(agendaDoc.appointments.some((a: { id: string }) => a.id === holdJson.appointment.id)).toBe(false);

      // Directorio de pacientes del odontólogo nunca incluye paciente-demo-2
      const pacDocRes = await docContext.request.get("/api/panel/pacientes");
      expect(pacDocRes.status()).toBe(200);
      const pacDoc = await pacDocRes.json();
      expect(pacDoc.patients.some((p: { id: string }) => p.id === "paciente-demo-2")).toBe(false);

      // Ficha clínica: ajeno -> 403, inexistente -> 404 (no 403 ni 500)
      const deniedRes = await docContext.request.get("/api/panel/clinica/paciente-demo-2");
      expect(deniedRes.status()).toBe(403);
      const missingRes = await docContext.request.get("/api/panel/clinica/paciente-inexistente-999");
      expect(missingRes.status()).toBe(404);

      // UI: abrir /panel/clinica?paciente=paciente-demo-2 muestra mensaje claro, limpia URL y mantiene lista disponible
      await page.goto("/panel/clinica?paciente=paciente-demo-2");
      await expect(page.locator("p[role='alert']")).toContainText(/no está asignado/i);
      await expect(page).not.toHaveURL(/paciente=paciente-demo-2/);
      await expect(page.locator("text=Paciente Ejemplo")).toBeVisible();

      // Confirmar la reserva pendiente -> ahora sí se asigna a odonto-a y aparece en su agenda
      const confirmRes = await request.post(`/api/reservas/${holdJson.token}`, {
        data: { action: "confirm" },
      });
      expect(confirmRes.status()).toBe(200);

      const agendaAfterConfirm = await docContext.request.get(`/api/panel/agenda?date=${day}&days=1`);
      const agendaConfirmedJson = await agendaAfterConfirm.json();
      const confirmedRow = agendaConfirmedJson.appointments.find((a: { id: string }) => a.id === holdJson.appointment.id);
      expect(confirmedRow).toBeTruthy();
      expect(confirmedRow.patientAssigned).toBe(true);
    } finally {
      // Limpiar reserva de prueba aunque falle un assert intermedio
      await request.post(`/api/reservas/${holdJson.token}`, { data: { action: "cancel" } });
    }
  });

  test("Tabla unificada Admin/Recepción (/panel/citas), asignación de doctores y validaciones de parámetros", async ({ page, request }) => {
    // Sin autenticación -> 401
    expect((await request.get("/api/panel/citas")).status()).toBe(401);
    expect((await request.post("/api/panel/asignaciones", { data: {} })).status()).toBe(401);

    // Odontólogo no accede a la tabla global de administración/secretaría
    await request.post("/api/sesion", {
      data: { email: "odontologia@demo.test", password: "DemoDental!101" },
    });
    expect((await request.get("/api/panel/citas")).status()).toBe(403);
    expect(
      (await request.post("/api/panel/asignaciones", {
        data: { action: "assign", patientId: "paciente-demo-1", professionalId: "odonto-a" },
      })).status(),
    ).toBe(403);

    // Recepción sí accede a /api/panel/citas y valida todos los parámetros
    const loginRec = await request.post("/api/sesion", {
      data: { email: "recepcion@demo.test", password: "DemoDental!101" },
    });
    expect(loginRec.status()).toBe(200);

    // Validaciones de query params en /api/panel/citas
    expect((await request.get("/api/panel/citas?professionalId=invalido")).status()).toBe(400);
    expect((await request.get("/api/panel/citas?status=ESTADO_FALSO")).status()).toBe(400);
    expect((await request.get("/api/panel/citas?assignment=raro")).status()).toBe(400);
    expect((await request.get("/api/panel/citas?from=2026-02-31")).status()).toBe(400);
    expect((await request.get("/api/panel/citas?from=2026-12-20&to=2026-12-10")).status()).toBe(400);
    expect((await request.get("/api/panel/citas?limit=999")).status()).toBe(400);

    const listRes = await request.get("/api/panel/citas");
    expect(listRes.status()).toBe(200);
    const listJson = await listRes.json();
    expect(Array.isArray(listJson.appointments)).toBe(true);
    expect(listJson.summary).toHaveProperty("total");
    expect(listJson.summary).toHaveProperty("assigned");
    expect(listJson.summary).toHaveProperty("unassigned");

    // Crear paciente sin asignar y probar /api/panel/asignaciones
    const uniqueSuffix = Date.now().toString().slice(-6);
    const createdPacRes = await request.post("/api/panel/pacientes", {
      data: { name: `Paciente Tabla ${uniqueSuffix}`, phone: `999${uniqueSuffix}`, dni: `48${uniqueSuffix}` },
    });
    expect(createdPacRes.status()).toBe(201);
    const { patient } = await createdPacRes.json();

    // DNI duplicado en alta -> 409
    const dupDniRes = await request.post("/api/panel/pacientes", {
      data: { name: "Paciente Duplicado", phone: `988${uniqueSuffix}`, dni: `48${uniqueSuffix}` },
    });
    expect(dupDniRes.status()).toBe(409);

    // Asignación con validaciones
    expect(
      (await request.post("/api/panel/asignaciones", {
        data: { action: "invalid", patientId: patient.id, professionalId: "odonto-a" },
      })).status(),
    ).toBe(400);
    expect(
      (await request.post("/api/panel/asignaciones", {
        data: { action: "assign", patientId: "no-existe-id", professionalId: "odonto-a" },
      })).status(),
    ).toBe(404);
    expect(
      (await request.post("/api/panel/asignaciones", {
        data: { action: "assign", patientId: patient.id, professionalId: "no-existe" },
      })).status(),
    ).toBe(400);

    const assignOk = await request.post("/api/panel/asignaciones", {
      data: { action: "assign", patientId: patient.id, professionalId: "odonto-a" },
    });
    expect(assignOk.status()).toBe(200);
    expect((await assignOk.json()).assignedProfessionalIds).toContain("odonto-a");

    const unassignOk = await request.post("/api/panel/asignaciones", {
      data: { action: "unassign", patientId: patient.id, professionalId: "odonto-a" },
    });
    expect(unassignOk.status()).toBe(200);
    expect((await unassignOk.json()).assignedProfessionalIds).not.toContain("odonto-a");

    // Verificar tabla UI /panel/citas como Recepción sin errores en consola
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    const loginPageRec = await page.context().request.post("/api/sesion", {
      data: { email: "recepcion@demo.test", password: "DemoDental!101" },
    });
    expect(loginPageRec.status()).toBe(200);
    await page.goto("/panel/citas");
    await expect(page.getByRole("heading", { name: "Citas, pacientes y doctores" })).toBeVisible();
    await expect(page.locator("table")).toBeVisible();
    await expect(page.locator("th", { hasText: "Paciente" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Doctor de la cita" })).toBeVisible();
    await expect(page.locator("th", { hasText: "Cargo clínico" })).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });

  test("Fuzzing de parámetros en reservas, agenda, clínica, pagos y mensajes (sin 500)", async ({ request }) => {
    // 1. Reservas públicas: fechas imposibles, bytes nulos, largos excedidos
    expect((await request.get("/api/reservas?fecha=2026-02-31")).status()).toBe(400);
    expect((await request.get("/api/reservas?mes=0001-01")).status()).toBe(400);
    expect((await request.get(`/api/reservas?servicio=${"a".repeat(120)}`)).status()).toBe(400);
    expect(
      (await request.post("/api/reservas", {
        data: {
          date: "2026-12-15",
          time: "10:00",
          name: "Test Nulo",
          phone: "966123123",
          dni: "12345678\u0000",
        },
      })).status(),
    ).toBe(400);

    // 2. Clinica sin sesión devuelve 401 incluso con ID malformado
    expect((await request.get("/api/panel/clinica/id!invalido")).status()).toBe(401);

    // 3. Agenda: días inválidos, acción inválida, estado inválido
    await request.post("/api/sesion", {
      data: { email: "admin@demo.test", password: "DemoDental!101" },
    });
    expect((await request.get("/api/panel/agenda?date=2026-12-15&days=30")).status()).toBe(400);
    expect((await request.post("/api/panel/agenda", { data: { action: "no_existe" } })).status()).toBe(400);
    expect(
      (await request.post("/api/panel/agenda", {
        data: { action: "status", appointmentId: "cita-demo-1", status: "ESTADO_RARO" },
      })).status(),
    ).toBe(400);

    // 4. Historia clínica: fecha calendario imposible -> 400 (nunca 500), adjunto vacío -> 400 (no 413)
    const badHistoryRes = await request.post("/api/panel/clinica/paciente-demo-1", {
      data: {
        action: "history",
        history: { attentionDate: "2026-02-31" },
      },
    });
    expect(badHistoryRes.status()).toBe(400);

    const emptyAttachment = await request.post("/api/panel/clinica/paciente-demo-1/adjuntos", {
      multipart: {
        file: { name: "vacio.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) },
      },
    });
    expect(emptyAttachment.status()).toBe(400);

    // 5. Mensajes: ID inexistente -> 404 (no 409)
    expect((await request.post("/api/panel/mensajes", { data: { id: "mensaje-inexistente" } })).status()).toBe(404);

    // 6. Pagos: rechaza abono contra cita CANCELLED (400)
    expect(
      (await request.post("/api/panel/pagos", {
        data: {
          action: "register",
          patientId: "paciente-demo-1",
          appointmentId: "no-existe",
          amountCents: 1000,
          method: "YAPE",
          reference: "ref-test-400",
        },
      })).status(),
    ).toBe(400);
  });
});
