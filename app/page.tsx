const deliveredItems = [
  "Next.js con App Router, React y TypeScript en modo estricto.",
  "Tailwind CSS con estilos locales, sin fuentes ni recursos de CDN.",
  "Scripts para desarrollo, arranque, tipos, lint y compilación.",
] as const;

const pendingItems = [
  "Validar con el consultorio las reglas de agenda, pagos y acceso clínico.",
  "Construir las rutas de negocio sobre esta base, en tareas posteriores.",
] as const;

export default function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded-md focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Saltar al contenido
      </a>

      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-widest text-teal-700">
          Base local de la aplicación
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
          Punto de partida del proyecto
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Esta página confirma que la aplicación arranca sin servicios externos.
          Todavía no contiene información comercial, contenido clínico ni datos de
          pacientes.
        </p>
      </header>

      <main id="contenido" className="flex-1 py-8">
        <section aria-labelledby="estado">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="estado" className="text-xl font-semibold text-slate-900">
              Estado
            </h2>
            <span className="rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
              Base técnica en construcción
            </span>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">
                Qué incluye esta base
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {deliveredItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-teal-700">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-slate-900">
                Qué falta definir
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-600">
                {pendingItems.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden="true" className="text-teal-700">
                      •
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section aria-labelledby="alcance" className="mt-8">
          <h2 id="alcance" className="text-xl font-semibold text-slate-900">
            Alcance de esta entrega
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            La instalación se reproduce desde el lockfile de npm y funciona de
            forma local. Las decisiones de producto, la autenticación, la base de
            datos y los pagos se incorporarán en tareas posteriores, cuando sus
            reglas estén confirmadas.
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-200 pt-6 text-xs leading-5 text-slate-500">
        <p>
          Documento de arranque técnico. No incluye información comercial ni datos
          personales.
        </p>
      </footer>
    </div>
  );
}
