"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ClinicBrand } from "@/app/components/clinic-brand";
import { errorMessage, roleLabels, StaffContext, staffFetch, type Role, type Staff } from "./agenda/staff";
import styles from "./agenda/staff.module.css";

const everyone: Role[] = ["ADMIN", "RECEPCION", "ODONTOLOGO"];
const destinations: { href: string; label: string; roles: Role[] }[] = [
  { href: "/panel", label: "Resumen", roles: everyone },
  { href: "/panel/agenda", label: "Agenda", roles: everyone },
  { href: "/panel/pacientes", label: "Pacientes", roles: everyone },
  { href: "/panel/clinica", label: "Clínica", roles: ["ADMIN", "ODONTOLOGO"] },
  { href: "/panel/pagos", label: "Pagos", roles: ["ADMIN", "RECEPCION"] },
  { href: "/panel/mensajes", label: "Mensajes", roles: ["ADMIN", "RECEPCION"] },
];

export default function StaffLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [sessionError, setSessionError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    staffFetch<{ user: Staff | null }>("/api/sesion", { signal: controller.signal })
      .then(({ user }) => {
        if (controller.signal.aborted) return;
        if (!user) {
          router.replace("/ingresar");
          return;
        }
        setStaff(user);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSessionError(errorMessage(error));
      });
    return () => controller.abort();
  }, [attempt, router]);

  async function signOut() {
    setSigningOut(true);
    setSessionError("");
    try {
      const response = await fetch("/api/sesion", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo cerrar la sesión.");
      }
      setStaff(null);
      router.replace("/ingresar");
    } catch (error) {
      setSessionError(errorMessage(error));
      setSigningOut(false);
    }
  }

  if (!staff) {
    return (
      <main className={styles.workspace}>
        <div className={styles.screenLoading}>
          {sessionError ? (
            <div className={styles.stack}>
              <p role="alert" className={styles.error}>{sessionError}</p>
              <button className={styles.secondary} type="button" onClick={() => {
                setSessionError("");
                setAttempt((value) => value + 1);
              }}>Reintentar</button>
              <Link href="/ingresar">Ir al acceso del equipo</Link>
            </div>
          ) : (
            <p role="status">Verificando la sesión…</p>
          )}
        </div>
      </main>
    );
  }

  const current = destinations.findLast((destination) => (
    pathname === destination.href || pathname.startsWith(destination.href + "/")
  ));
  const allowed = !current || current.roles.includes(staff.role);

  return (
    <StaffContext.Provider value={staff}>
      <div className={styles.workspace}>
        <a className={styles.skip} href="#contenido">Saltar al contenido</a>
        <header className={styles.bar}>
          <div className={styles.wrap}>
            <div className={styles.barRow}>
              <ClinicBrand href="/panel" />
              <div className={styles.account}>
                <span>{roleLabels[staff.role]}</span>
                <button className={styles.secondary} type="button" disabled={signingOut} onClick={signOut}>
                  {signingOut ? "Cerrando…" : "Cerrar sesión"}
                </button>
              </div>
            </div>
            <nav aria-label="Panel del equipo" className={styles.nav}>
              {destinations.filter((destination) => destination.roles.includes(staff.role)).map((destination) => (
                <Link key={destination.href} href={destination.href} aria-current={current?.href === destination.href ? "page" : undefined}>
                  {destination.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className={`${styles.wrap} ${styles.main}`} id="contenido" tabIndex={-1}>
          {sessionError && <p role="alert" className={styles.error}>{sessionError}</p>}
          {allowed ? children : (
            <section className={`${styles.card} ${styles.stack}`}>
              <h1>Acceso restringido</h1>
              <p>Esta sección requiere otro rol del equipo.</p>
              <Link className={styles.secondary} href="/panel">Volver al resumen</Link>
            </section>
          )}
        </main>
      </div>
    </StaffContext.Provider>
  );
}
