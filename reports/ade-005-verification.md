# ADE-005 — Verificación de la base local

**Fecha:** 2026-11-23
**Rama:** `ade-005/base-next`
**Modelo:** DeepSeek V4.1 Flash Free (OpenCode)

## Entorno

- Windows con PowerShell.
- Node.js `v26.12.1`.
- npm `11.20.0`.
- Next.js `16.4.6` (App Router, Turbopack).
- React y React DOM `19.3.1`.
- TypeScript `5.9.3`.
- Tailwind CSS y `@tailwindcss/postcss` `4.3.5`.
- ESLint `9.39.5` y `eslint-config-next` `16.4.6`.

Las versiones se consultaron con `npm view` antes de fijarlas. Se eligió
TypeScript 5.9.3 porque `typescript-eslint` declara compatibilidad con
`typescript <6.1.0`, y ESLint 9.39.5 porque los plugins que usa
`eslint-config-next` declaran compatibilidad hasta la línea 9.

## Resultados desde un checkout limpio

Se eliminaron `node_modules`, `.next`, `next-env.d.ts` y `*.tsbuildinfo` antes de
la validación.

| Comando | Resultado | Tiempo |
|---|---|---|
| `npm.cmd ci --no-audit --no-fund` | Correcto, 360 paquetes desde el lockfile | 39,78 s |
| `npm.cmd run typecheck` | Correcto, sin errores | 2,14 s |
| `npm.cmd run lint` | Correcto, sin errores | 4,82 s |
| `npm.cmd run build` | Correcto, 3 páginas estáticas generadas | 9,80 s |
| Smoke HTTP con `npm.cmd run start -- -p 3105` | `200`, `text/html; charset=utf-8`, 14 080 bytes | — |

El smoke HTTP comprobó `lang="es-PE"`, el título del sitio, el encabezado
principal y la directiva `noindex`. La compilación reportó 2,7 s de compilación,
1,829 s de TypeScript y 828 ms de generación de páginas.

## Fallos y observaciones

- `npm install` y `npm ci` muestran una advertencia de deprecación para
  `eslint@9.39.5`: npm lo marca como fuera de soporte. No impide la instalación
  ni el lint; se mantiene por compatibilidad con los plugins de
  `eslint-config-next` 16.4.6.
- En la primera compilación, Next.js cambió `jsx` de `preserve` a `react-jsx` y
  generó `next-env.d.ts`. El archivo generado está excluido por `.gitignore`; la
  validación limpia de tipos funciona sin él.
- No hubo otros fallos.

## Alcance comprobado

La base no incluye landing comercial, rutas de negocio, autenticación, Prisma,
Supabase, migraciones, shadcn/ui, pagos ni despliegues. La página de arranque no
usa CDN de fuentes ni dependencias de red en runtime y no contiene datos reales
ni inventados del consultorio.
