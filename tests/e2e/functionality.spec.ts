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

  test("Flujo completo: Calendario -> Horarios -> Datos del paciente -> Confirmación", async ({ page }) => {
    const pageStart = Date.now();
    await page.goto("/reservar");
    const pageLoadTime = Date.now() - pageStart;
    expect(pageLoadTime).toBeLessThan(3500);

    // Paso 1: Elegir día en calendario
    await expect(page.locator("h1")).toContainText("Paso 1");

    // Seleccionar una fecha futura válida (por ejemplo dentro de 5 días)
    const today = new Date();
    const futureDate = new Date(today);
    futureDate.setDate(today.getDate() + 5);
    // Si cae domingo, sumar un día
    if (futureDate.getDay() === 0) {
      futureDate.setDate(futureDate.getDate() + 1);
    }
    const futureDateStr = futureDate.toISOString().slice(0, 10);

    // Usar el input de fecha o click en el día
    const dateInput = page.locator("#calendar-date-input");
    await dateInput.fill(futureDateStr);

    // Click en "Ver horarios disponibles"
    const nextBtn = page.getByRole("button", { name: /ver horarios disponibles/i });
    await nextBtn.click();

    // Paso 2: Horarios disponibles
    await expect(page.locator("h1")).toContainText("Paso 2");

    // Esperar a que carguen los slots disponibles
    const slotButtons = page.locator("button:has-text(':')");
    await expect(slotButtons.first()).toBeVisible({ timeout: 10000 });

    // Elegir el primer slot disponible
    await slotButtons.first().click();

    // Continuar al paso 3
    const toPatientBtn = page.getByRole("button", { name: /completar mis datos/i });
    await expect(toPatientBtn).toBeEnabled();
    await toPatientBtn.click();

    // Paso 3: Completar datos del paciente
    await expect(page.locator("h1")).toContainText("Paso 3");

    // Llenar formulario
    await page.locator("#patient-name").fill("Juan Carlos Quispe");
    await page.locator("#patient-phone").fill("966987654");
    await page.locator("#patient-dni").fill("72345678");
    await page.locator("#patient-email").fill("juan.quispe@example.pe");
    await page.locator("#patient-reason").fill("Revisión general y limpieza preventiva");

    // Click en Confirmar reserva
    const submitBtn = page.getByRole("button", { name: /confirmar reserva/i });
    await submitBtn.click();

    // Paso 4: Pantalla de confirmación
    await expect(page.locator("h1")).toContainText("¡Tu", { timeout: 10000 });
    await expect(page.locator("text=Juan Carlos Quispe")).toBeVisible();
    await expect(page.locator("text=Edu Gómez Delgado")).toBeVisible();
    await expect(page.locator("text=Huamanga")).toBeVisible();
  });
});
