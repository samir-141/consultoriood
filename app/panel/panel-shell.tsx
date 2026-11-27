"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ClinicBrand } from "@/app/components/clinic-brand";
import { professionals } from "@/config/site";
import { errorMessage, roleLabels, StaffContext, type Role, type Staff } from "./agenda/staff";
import styles from "./agenda/staff.module.css";

const everyone: Role[] = ["ADMIN", "RECEPCION", "ODONTOLOGO"];
const destinations: { href: string; label: string; roles: Role[] }[] = [
  { href: "/panel", label: "Resumen", roles: everyone },
  { href: "/panel/agenda", label: "Agenda", roles: everyone },
  { href: "/panel/citas", label: "Citas y doctores", roles: ["ADMIN", "RECEPCION"] },
  { href: "/panel/pacientes", label: "Pacientes", roles: everyone },
  { href: "/panel/clinica", label: "Clínica", roles: ["ADMIN", "ODONTOLOGO"] },
  { href: "/panel/pagos", label: "Pagos", roles: ["ADMIN", "RECEPCION"] },
  { href: "/panel/mensajes", label: "Mensajes", roles: ["ADMIN", "RECEPCION"] },
];

export function StaffShell({ initialStaff, children }: { initialStaff: Staff; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [staff] = useState<Staff>(initialStaff);
  const [sessionError, setSessionError] = useState("");
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    setSessionError("");
    try {
      const response = await fetch("/api/sesion", { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo cerrar la sesión.");
      }
      router.replace("/ingresar");
      router.refresh();
    } catch (error) {
      setSessionError(errorMessage(error));
      setSigningOut(false);
    }
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
                <div className={styles.accountMeta}>
                  <strong>{staff.name}</strong>
                  <span>
                    {roleLabels[staff.role]}
                    {staff.professionalId
                      ? (() => {
                        const prof = professionals.find((p) => p.id === staff.professionalId);
                        return prof?.title ? ` · ${prof.title}` : "";
                      })()
                      : ""}
                  </span>
                </div>
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
