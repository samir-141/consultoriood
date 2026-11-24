import { strict as assert } from "node:assert";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const root = fileURLToPath(new URL("..", import.meta.url));
const temporary = await mkdtemp(join(tmpdir(), "consultorio-verify-"));
const database = join(temporary, "postgres");
const next = join(root, "node_modules", "next", "dist", "bin", "next");

const socket = createServer();
socket.listen(0, "127.0.0.1");
await once(socket, "listening");
const { port } = socket.address();
await new Promise((done, reject) => socket.close((error) => error ? reject(error) : done()));
const base = "http://127.0.0.1:" + port;
let server;
let output = "";

async function boot() {
  server = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root, env: { ...process.env, DENTAL_DATA_DIR: database }, windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [server.stdout, server.stderr]) stream.on("data", (data) => {
    output = (output + data).slice(-10_000);
  });
  for (let tries = 0; tries < 80; tries += 1) {
    if (server.exitCode !== null) break;
    try {
      if ((await fetch(base + "/api/catalogo")).ok) return;
    } catch {
      // The server is still starting.
    }
    await delay(200);
  }
  throw new Error("El servidor de verificación no arrancó. Ejecuta npm run build primero.");
}

async function stop() {
  if (!server || server.exitCode !== null || server.signalCode !== null) return;
  const done = once(server, "exit");
  server.kill();
  await done;
}

async function request(path, { method = "GET", body, cookie, origin = base, status = 200, headers: extraHeaders } = {}) {
  const headers = { ...extraHeaders };
  if (cookie) headers.Cookie = cookie;
  if (!["GET", "HEAD"].includes(method)) headers.Origin = origin;
  if (body !== undefined && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method, headers, body: body === undefined || body instanceof FormData ? body : JSON.stringify(body),
    redirect: "manual",
  }).catch((cause) => {
    throw new Error(`${method} ${path} no recibió respuesta`, { cause });
  });
  const type = response.headers.get("content-type") ?? "";
  const data = type.includes("application/json") ? await response.json() : await response.text();
  assert.equal(response.status, status, path + " devolvió " + response.status + " en vez de " + status + ": " + JSON.stringify(data).slice(0, 400));
  return { response, data };
}

async function login(email) {
  const { response } = await request("/api/sesion", {
    method: "POST", body: { email, password: "DemoDental!101" },
  });
  const header = response.headers.get("set-cookie");
  assert.match(header, /HttpOnly/i);
  assert.match(header, /SameSite=Strict/i);
  return header.split(";")[0];
}

async function post(path, body, cookie, status = 200) {
  return (await request(path, { method: "POST", body, cookie, status })).data;
}

const localToday = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
let future = new Date(localToday + "T00:00:00Z");
future.setUTCDate(future.getUTCDate() + 4);
if (future.getUTCDay() === 0) future = new Date(future.getTime() + 86_400_000);
const day = future.toISOString().slice(0, 10);
const baseBooking = { date: day, time: "10:00", serviceId: "limpieza", professionalId: "odonto-a", phone: "900010101" };

try {
  await boot();
  const { data: landing } = await request("/");
  assert.match(landing, /Gómez Delgado/);
  assert.match(landing, /consulta-ilustrativa\.webp/);
  assert.match(landing, /<meta name="robots" content="noindex, nofollow"/);
  const { response: photo } = await request("/fotografia/consulta-ilustrativa.webp", { method: "HEAD" });
  assert.match(photo.headers.get("content-type"), /^image\/webp\b/);
  assert.ok(Number(photo.headers.get("content-length")) < 200_000);
  const { data: robots } = await request("/robots.txt");
  assert.match(robots, /Disallow:\s*\/\s*$/m);
  await request("/sitemap.xml");
  await request("/privacidad");
  await request("/servicios/desconocido", { status: 404 });
  for (const service of ["evaluacion", "limpieza", "control"]) {
    const { data: detail } = await request(`/servicios/${service}`);
    assert.match(detail, new RegExp(`/reservar\\?servicio=${service}`));
  }
  await request("/reservar");
  await request("/ingresar");
  for (const name of ["marca", "gomita-saludo", "gomita-pensando", "gomita-exito"]) {
    const { response } = await request(`/identidad/${name}.svg`);
    assert.match(response.headers.get("content-type"), /^image\/svg\+xml\b/);
  }
  const { data: catalog } = await request("/api/catalogo");
  assert.equal(catalog.clinic.name, "Gómez Delgado");
  assert.equal(catalog.services.length, 3);
  console.log("✓ Portada, fotografía WebP, tratamientos, privacidad e indexación de la demo");

  await request("/api/panel/agenda", { status: 401 });
  await request("/api/sesion", {
    method: "POST", body: {}, origin: "https://otro.example.test", status: 403,
  });
  const { response: largeBody } = await request("/api/reservas", {
    method: "POST", body: { padding: "a".repeat(256 * 1024) }, status: 413,
  });
  assert.match(largeBody.headers.get("cache-control"), /private, no-store/);
  const reception = await login("recepcion@demo.test");
  const dentist = await login("odontologia@demo.test");
  const admin = await login("admin@demo.test");
  await request("/api/panel/clinica/paciente-demo-1", { cookie: reception, status: 403 });
  await request("/api/panel/clinica/paciente-demo-2", { cookie: dentist, status: 403 });
  await request("/api/panel/clinica/paciente-demo-2/adjuntos", { method: "POST", body: {}, cookie: dentist, status: 403 });
  const { data: directory } = await request("/api/panel/pacientes", { cookie: dentist });
  assert.deepEqual(directory.patients.map(({ id }) => id), ["paciente-demo-1"]);
  const savedPatient = await post("/api/panel/pacientes", {
    name: "Paciente de integración", phone: "900010103", email: "integracion@example.test", birthDate: "1983-01-12",
  }, reception, 201);
  assert.equal(savedPatient.patient.birthDate, "1983-01-12");
  console.log("✓ Sesiones, roles, pacientes y asignación clínica");

  const { data: upcoming, response: upcomingResponse } = await request("/api/disponibilidad/proxima?serviceId=evaluacion");
  assert.match(upcomingResponse.headers.get("cache-control"), /no-store/);
  assert.deepEqual(Object.keys(upcoming), ["slot"]);
  assert.ok(upcoming.slot.date >= localToday);
  assert.deepEqual(Object.keys(upcoming.slot).sort(), ["date", "professionalId", "professionalName", "time"]);
  const { data: sameDay } = await request(`/api/disponibilidad?date=${upcoming.slot.date}&serviceId=evaluacion`);
  assert.deepEqual(sameDay.slots[0], upcoming.slot);
  await request("/api/disponibilidad/proxima?serviceId=desconocido", { status: 400 });

  const retryBody = { ...baseBooking, time: "15:00", name: "Paciente con reintento" };
  const retryRequest = {
    method: "POST", body: retryBody, status: 201, headers: { "Idempotency-Key": randomUUID() },
  };
  const [firstAttempt, retry] = await Promise.all([
    request("/api/reservas", retryRequest), request("/api/reservas", retryRequest),
  ]);
  assert.deepEqual(firstAttempt.data, retry.data);
  const { data: { patients: [retryPatient] } } = await request("/api/panel/pacientes?q=" + encodeURIComponent(retryBody.name), { cookie: reception });
  assert.ok(retryPatient);
  await post("/api/panel/pacientes", { ...retryPatient, phone: "900010104" }, reception);
  assert.deepEqual((await request("/api/reservas", retryRequest)).data, firstAttempt.data);
  await request("/api/reservas", { ...retryRequest, body: { ...retryBody, time: "15:15" }, status: 409 });
  await post("/api/reservas/" + firstAttempt.data.token, { action: "cancel" });
  console.log("✓ Próxima disponibilidad e idempotencia de reserva");

  const availability = "/api/disponibilidad?date=" + day + "&serviceId=limpieza&professionalId=odonto-a";
  const before = await request(availability);
  assert.ok(before.data.slots.some(({ time }) => time === "10:00"));
  const competitors = await Promise.all(["Paciente de prueba A", "Paciente de prueba B"].map((name) => fetch(base + "/api/reservas", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...baseBooking, name, whatsappOptIn: true }),
  })));
  assert.deepEqual(competitors.map(({ status }) => status).sort(), [201, 409]);
  const hold = await competitors.find(({ status }) => status === 201).json();
  assert.equal(hold.appointment.status, "PENDING");
  assert.ok(new Date(hold.expiresAt).getTime() > Date.now() + 9 * 60_000);
  const after = await request(availability);
  assert.ok(!after.data.slots.some(({ time }) => time === "10:00"));
  const manage = "/api/reservas/" + hold.token;
  const confirmed = await post(manage, { action: "confirm" });
  assert.equal(confirmed.appointment.status, "CONFIRMED");
  assert.equal((await post(manage, { action: "confirm" })).appointment.id, hold.appointment.id);
  const moved = await post(manage, { action: "reschedule", date: day, time: "11:30", professionalId: "odonto-a" });
  assert.notEqual(moved.appointment.id, hold.appointment.id);
  assert.equal(moved.appointment.time, "11:30");
  const { data: roster } = await request("/api/panel/agenda?date=" + day, { cookie: reception });
  assert.equal(roster.appointments.find(({ id }) => id === hold.appointment.id).status, "RESCHEDULED");
  const block = await post("/api/panel/agenda", {
    action: "block", date: day, time: "14:00", endTime: "15:00", professionalId: "odonto-a", reason: "Bloqueo de prueba",
  }, reception);
  assert.ok(!(await request(availability)).data.slots.some(({ time }) => time === "14:00"));
  await post("/api/panel/agenda", { action: "unblock", blockId: block.id }, reception);
  const staffBooking = await post("/api/panel/agenda", {
    action: "create", patientId: savedPatient.patient.id, date: day, time: "14:00", serviceId: "control", professionalId: "odonto-a",
  }, reception);
  await post("/api/panel/agenda", {
    action: "cancel", appointmentId: staffBooking.appointment.id,
  }, dentist, 403);
  await post("/api/panel/agenda", {
    action: "status", appointmentId: staffBooking.appointment.id, status: "NO_SHOW",
  }, dentist, 409);
  for (const status of ["CHECKED_IN", "IN_PROGRESS", "COMPLETED"]) {
    const updated = await post("/api/panel/agenda", { action: "status", appointmentId: staffBooking.appointment.id, status }, dentist);
    assert.equal(updated.appointment.status, status);
  }
  assert.equal((await post(manage, { action: "cancel" })).appointment.status, "CANCELLED");
  console.log("✓ Retención, concurrencia, confirmación repetida, reprogramación, cancelación y bloqueos");

  const messageHold = await post("/api/reservas", {
    ...baseBooking, time: "12:45", name: "Paciente para mensaje", whatsappOptIn: true,
  }, undefined, 201);
  await post("/api/reservas/" + messageHold.token, { action: "confirm" });
  const { data: queue } = await request("/api/panel/mensajes", { cookie: reception });
  const confirmation = queue.messages.find((job) => job.kind === "CONFIRMACION" && job.patientName === "Paciente para mensaje");
  assert.equal(confirmation.managePath, "/mi-cita/" + messageHold.token);
  assert.ok(queue.messages.some((job) => job.kind === "RECORDATORIO" && job.patientName === confirmation.patientName));
  await post("/api/panel/mensajes", { id: confirmation.id }, reception);
  assert.equal((await request("/api/panel/mensajes", { cookie: reception })).data.messages
    .find(({ id }) => id === confirmation.id).status, "SIMULADO");
  console.log("✓ Cola de WhatsApp de demostración, consentimiento y enlace vigente");

  const clinicalPath = "/api/panel/clinica/paciente-demo-1";
  const note = await post(clinicalPath, {
    action: "note", appointmentId: "cita-demo-1", reason: "Control sintético",
    findings: "Muestra", procedure: "", instructions: "Control de prueba",
  }, dentist, 201);
  await post(clinicalPath, {
    action: "note", appointmentId: "cita-demo-1", amendsId: note.id, reason: "Enmienda sintética",
  }, dentist, 201);
  await post(clinicalPath, {
    action: "odontogram", tooth: 16, surface: "OCLUSAL", status: "OBSERVACION", observation: "Hallazgo sintético",
  }, dentist, 201);
  await post(clinicalPath, { action: "consent", type: "Atención de prueba", status: "ACCEPTED" }, dentist, 201);
  const plan = await post(clinicalPath, {
    action: "plan", title: "Plan sintético",
    items: [{ tooth: 16, procedure: "Evaluación de prueba", priceCents: 6000 }],
  }, dentist, 201);
  const pdf = "%PDF-1.4\n% archivo sintético\n%%EOF\n";
  const form = new FormData();
  form.set("file", new Blob([pdf], { type: "application/pdf" }), "muestra.pdf");
  const uploaded = await request(clinicalPath + "/adjuntos", { method: "POST", body: form, cookie: dentist, status: 201 });
  const { data: clinical } = await request(clinicalPath, { cookie: admin });
  assert.ok(clinical.notes.some((entry) => entry.id === note.id && entry.reason === "Control sintético"));
  assert.ok(clinical.notes.some((entry) => entry.amendsId === note.id));
  assert.ok(clinical.odontogram.some(({ tooth }) => String(tooth) === "16"));
  assert.ok(clinical.patient.consents.some(({ type }) => type === "Atención de prueba"));
  assert.equal(clinical.plans.find(({ id }) => id === plan.id).totalCents, 6000);
  const attachment = clinical.attachments.find(({ name }) => name === "muestra.pdf");
  assert.ok(attachment && uploaded.data);
  const link = clinicalPath + "/adjuntos/" + attachment.id;
  await request(link, { cookie: reception, status: 403 });
  assert.equal((await request(link, { cookie: dentist })).data, pdf);
  assert.ok((await request(clinicalPath, { cookie: admin })).data.audit.length > 0);
  console.log("✓ Ficha clínica, odontograma, adjuntos privados y auditoría");

  const paymentPath = "/api/panel/pagos";
  const { payment } = await post(paymentPath, {
    action: "register", patientId: "paciente-demo-1", appointmentId: "cita-demo-1", amountCents: 2500,
    method: "YAPE", reference: "prueba-101", proofName: "abono.pdf", proofMime: "application/pdf",
    proofBase64: Buffer.from(pdf).toString("base64"),
  }, reception, 201);
  assert.equal(payment.status, "PENDING");
  await post(paymentPath, { action: "approve", id: payment.id }, reception);
  const balances = (await request(paymentPath + "?patientId=paciente-demo-1", { cookie: reception })).data.balances;
  assert.equal(balances.find(({ id }) => id === "cita-demo-1").balanceCents, 5500);
  await request(paymentPath + "/" + payment.id + "/comprobante", { cookie: dentist, status: 403 });
  assert.equal((await request(paymentPath + "/" + payment.id + "/comprobante", { cookie: reception })).data, pdf);
  await post(paymentPath, { action: "refund", id: payment.id, reason: "Prueba de devolución" }, reception, 403);
  assert.equal((await post(paymentPath, { action: "refund", id: payment.id, reason: "Prueba de devolución" }, admin)).payment.status, "REFUNDED");
  console.log("✓ Abono, comprobante privado, saldo y devolución por rol");

  const expiring = await post("/api/reservas", { ...baseBooking, time: "15:30", name: "Paciente de vencimiento" }, undefined, 201);
  await stop();
  const fixture = new PGlite(database, { extensions: { btree_gist } });
  try {
    await fixture.query("UPDATE appointments SET hold_expires_at=now()-interval '1 minute' WHERE id=$1", [expiring.appointment.id]);
    await fixture.query(`
      UPDATE appointments SET starts_at=now()-interval '49 hours',
        ends_at=now()-interval '48 hours 15 minutes', occupied_until=now()-interval '48 hours 5 minutes'
      WHERE id=$1
    `, [firstAttempt.data.appointment.id]);
  } finally {
    await fixture.close();
  }
  await boot();
  await post("/api/reservas/" + expiring.token, { action: "confirm" }, undefined, 410);
  await request("/api/reservas/" + firstAttempt.data.token, { status: 410 });
  assert.ok((await request(availability)).data.slots.some(({ time }) => time === "15:30"));
  assert.equal((await request("/api/reservas/" + messageHold.token)).data.appointment.status, "CONFIRMED");
  assert.equal((await request("/api/sesion", { cookie: admin })).data.user.role, "ADMIN");
  console.log("✓ Vencimiento efectivo y persistencia después de reiniciar");
} catch (error) {
  if (output) process.stderr.write(output);
  throw error;
} finally {
  await stop();
  if (dirname(resolve(temporary)) === resolve(tmpdir()) && basename(temporary).startsWith("consultorio-verify-")) {
    await rm(temporary, { recursive: true, force: true });
  }
}
