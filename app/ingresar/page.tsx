"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./login.module.css";

const demoAccounts = [
  { label: "Recepción", email: "recepcion@demo.test" },
  { label: "Odontología", email: "odontologia@demo.test" },
  { label: "Administración", email: "admin@demo.test" },
];

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/sesion", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar sesión.");
      router.replace("/panel");
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : "No se pudo iniciar sesión.");
      setBusy(false);
    }
  }

  return (
    <main className={styles.login}>
      <div className={styles.frame}>
        <Link className={styles.back} href="/">Volver al inicio</Link>
        <section className={styles.paper} aria-labelledby="sign-in-title">
          <span className={styles.mark} aria-hidden="true">+</span>
          <h1 id="sign-in-title">Acceso del equipo</h1>
          <p>Ingresa para trabajar con la agenda y las herramientas del consultorio.</p>
          <form className={styles.form} onSubmit={signIn}>
            <label className={styles.field}>
              Correo
              <input type="email" name="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className={styles.field}>
              Contraseña
              <input type="password" name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            {error && <p className={styles.error} role="alert">{error}</p>}
            <button className={styles.button} type="submit" disabled={busy}>{busy ? "Ingresando…" : "Ingresar al panel"}</button>
          </form>
          <details className={styles.options}>
            <summary>Accesos de demostración</summary>
            <p>Elige una cuenta de ejemplo y usa datos ficticios en el panel.</p>
            <div className={styles.roles}>
              {demoAccounts.map((account) => (
                <button key={account.email} type="button" disabled={busy} onClick={() => {
                  setEmail(account.email);
                  setPassword("DemoDental!101");
                  setError("");
                }}>{account.label}</button>
              ))}
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}
