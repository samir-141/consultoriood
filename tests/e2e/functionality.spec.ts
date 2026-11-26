import { test, expect } from "@playwright/test";

test.describe("Agente de Funcionalidad - Flujo Completo y Reglas de Negocio", () => {
  test("Los enlaces de login/admin no deben ser visibles en la navegación pública", async ({ page }) => {
    await page.goto("/");

    // Comprobar que en header y footer no haya enlaces a login o ingresar
    const loginLinksInNav = page.locator("header a[href*='ingresar'], header a[href*='panel'], footer a[href*='ingresar'], footer a[href*='panel']");
    await expect(loginLinksInNav).toHaveCount(0);

    // Los enlaces públicos válidos deben existir
    const serviciosLink = page.locator("header nav a[href='#servicios']");
    await expect(serviciosLink).toBeVisible();

    // El acceso directo por URL sigue funcionando
    const loginRes = await page.goto("/ingresar");
    expect(loginRes?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
  });

  test("Regla de doctor único: no debe mostrar selector si hay solo un doctor", async ({ page }) => {
    await page.goto("/reservar");

    // Verificar que NO exista un select de doctor
    const doctorSelect = page.locator("select#doctor-select");
    await expect(doctorSelect).toHaveCount(0);

    // Verificar que muestre la asignación automática con el nombre del doctor
    const assignedDoctorText = page.locator("text=Edu Gómez Delgado");
    await expect(assignedDoctorText).toBeVisible();
  });

  test("Regla de 15 minutos y aviso de consultas presenciales con posible espera", async ({ page }) => {
    await page.goto("/reservar");
    await expect(page.locator("h1")).toContainText("Paso 1");

    // Debe informar la regla de 15 minutos y consultas presenciales con posible espera
    await expect(page.locator("text=/15 min/i").first()).toBeVisible();
    await expect(page.locator("text=/consultas presenciales/i").first()).toBeVisible();
    await expect(page.locator("text=/posible espera/i").first()).toBeVisible();
  });

  test("Flujo completo: Calendario -> Selector desplegable de horarios -> Datos -> Confirmación", async ({ page }) => {
    const pageStart = Date.now();
    await page.goto("/reservar");
    const pageLoadTime = Date.now() - pageStart;
    expect(pageLoadTime).toBeLessThan(3500);

    // Paso 1: Calendario visible y selector desplegable al seleccionar fecha
    await expect(page.locator("h1")).toContainText("Paso 1");

    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 5);
    if (futureDate.getDay() === 0) {
      futureDate.setDate(futureDate.getDate() + 1);
    }
    const futureDateStr = futureDate.toISOString().slice(0, 10);

    const dateInput = page.locator("#calendar-date-input");
    await dateInput.fill(futureDateStr);

    // El selector de horarios se despliega automáticamente en la misma vista
    await expect(page.locator("h2:has-text('Horarios para el')")).toBeVisible({ timeout: 10000 });

    const firstAvailableSlot = page.locator("button:has-text('Disponible')").first();
    await expect(firstAvailableSlot).toBeVisible({ timeout: 10000 });
    await firstAvailableSlot.click();

    // Al seleccionar un horario se marca y bloquea como elegido
    await expect(page.locator("text=Horario seleccionado y bloqueado para ti:")).toBeVisible();

    // Continuar al paso 2 (Datos del paciente)
    const toPatientBtn = page.getByRole("button", { name: /completar mis datos/i });
    await expect(toPatientBtn).toBeEnabled();
    await toPatientBtn.click();

    // Paso 2: Completar datos del paciente
    await expect(page.locator("h1")).toContainText("Paso 2");

    await page.locator("#patient-name").fill("Juan Carlos Quispe");
    await page.locator("#patient-phone").fill("966987654");
    await page.locator("#patient-dni").fill("72345678");
    await page.locator("#patient-email").fill("juan.quispe@example.pe");
    await page.locator("#patient-reason").fill("Revisión general y limpieza preventiva");

    const submitBtn = page.getByRole("button", { name: /confirmar reserva/i });
    await submitBtn.click();

    // Paso 3: Pantalla de confirmación
    await expect(page.locator("h1")).toContainText("¡Tu", { timeout: 10000 });
    await expect(page.locator("text=Juan Carlos Quispe")).toBeVisible();
    await expect(page.locator("text=Edu Gómez Delgado")).toBeVisible();
    await expect(page.locator("text=Huamanga")).toBeVisible();
  });

  test("Lógica 45 min en intervalos de 30 min: bloquea 2 bloques consecutivos y cirugías/días libres bloquean la agenda", async ({ page }) => {
    await page.goto("/reservar");
    const serviceSelect = page.locator("#service-select");
    await serviceSelect.selectOption("limpieza"); // 45 min

    await expect(page.locator("text=se bloquearán")).toBeVisible();
    await expect(page.locator("text=2 bloques consecutivos")).toBeVisible();

    const firstSlot = page.locator("button:has-text('Disponible')").first();
    await expect(firstSlot).toBeVisible({ timeout: 10000 });
    await firstSlot.click();

    // Verifica que indique 2 bloques de 30 min cubiertos
    await expect(page.locator("text=✓ 2 bloques")).toBeVisible();
    await expect(page.locator("text=Incluido (45m)")).toBeVisible();
  });

  test("Panel de recepción y odontólogo: card de orden, recordatorio 30m y permisos de día libre", async ({ page }) => {
    await page.goto("/ingresar");
    await page.getByLabel("Correo").fill("recepcion@demo.test");
    await page.getByLabel("Contraseña").fill("DemoDental!101");
    await page.getByRole("button", { name: /ingresar al panel/i }).click();

    await page.waitForURL("**/panel");
    await expect(page.locator("#reminders-30m-title")).toContainText("Confirmación de visita (30 min antes)");
    await expect(page.locator("#today-title")).toContainText("Orden de pacientes hoy");

    await page.goto("/panel/mensajes");
    await expect(page.locator("#future-bot-heading")).toContainText("Bot de WhatsApp con API Local");

    await page.goto("/panel/agenda");
    await expect(page.getByRole("button", { name: /cirugía \/ día libre/i })).toBeVisible();
  });

  test("Historia Clínica: Modo 1 Llenado y Modo 2 Visualización con persistencia y odontograma", async ({ page }) => {
    await page.goto("/ingresar");
    await page.getByLabel("Correo").fill("odontologia@demo.test");
    await page.getByLabel("Contraseña").fill("DemoDental!101");
    await page.getByRole("button", { name: /ingresar al panel/i }).click();
    await page.waitForURL("**/panel");

    await page.goto("/panel/clinica?paciente=paciente-demo-1");
    await expect(page.getByRole("tab", { name: /1\. Llenado de Historia/i })).toBeVisible({ timeout: 10000 });

    // Modo 1: Llenar Anamnesis
    await page.getByLabel("N° Historia Clínica").fill("HC-2026-01");
    await page.getByLabel("Motivo de consulta").fill("Dolor en molar superior derecho al masticar");
    await page.locator("input[name='drugAllergy']").nth(1).check();
    await page.getByPlaceholder("Especificar medicamento o reacción (si aplica)").fill("Penicilina");

    // Ir a Paso 2: Examen y Signos Vitales
    await page.getByRole("tab", { name: /2\. Examen y Dx/i }).click();
    await page.getByLabel("P.A.").fill("118/78 mmHg");
    await page.getByLabel("IV. Diagnóstico Definitivo").fill("Pulpitis reversible en pieza 16");

    // Ir a Paso 3: Odontograma y marcar pieza 16
    await page.getByRole("tab", { name: /3\. Odontograma/i }).click();
    await page.getByRole("button", { name: /Pieza 16/i }).click();
    await page.getByLabel("Nota rápida de pieza").fill("Caries oclusal");

    // Captura de Modo 1 (Odontograma / Llenado)
    await page.screenshot({ path: "reports/screenshots/clinica-modo-llenado.png", fullPage: false });

    // Guardar historia clínica
    await page.getByRole("button", { name: /guardar historia clínica/i }).first().click();
    await expect(page.getByText("Historia clínica guardada correctamente.")).toBeVisible({ timeout: 10000 });

    // Cambiar a Modo 2: Visualizar Datos y verificar todo
    await page.getByRole("tab", { name: /2\. Visualizar Datos/i }).click();
    await expect(page.getByText(/Alergia a medicamentos reportada/i)).toBeVisible();
    await expect(page.getByText("Penicilina").first()).toBeVisible();
    await expect(page.getByText("118/78 mmHg")).toBeVisible();
    await expect(page.getByText("Pulpitis reversible en pieza 16")).toBeVisible();

    // Captura de Modo 2 (Visualización)
    await page.screenshot({ path: "reports/screenshots/clinica-modo-visualizar.png", fullPage: false });

    // Recargar y confirmar persistencia desde base de datos
    await page.reload();
    await page.getByRole("tab", { name: /2\. Visualizar Datos/i }).click({ timeout: 10000 });
    await expect(page.getByText("Dolor en molar superior derecho al masticar")).toBeVisible();
    await expect(page.getByText("HC-2026-01").first()).toBeVisible();
  });
});
