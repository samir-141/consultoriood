# ADE-005 — Verificación de la base local

**Fecha:** 2026-11-23
**Rama:** `ade-005/base-next`
**Modelo:** DeepSeek V4.1 Flash Free (OpenCode)

## Entorno

- Windows con PowerShell.
- Node.js `v26.12.1`, versión probada.
- npm `11.20.0`.
- Next.js `16.4.6` (App Router, Turbopack).
- React y React DOM `19.3.1`.
- TypeScript `5.9.3`.
- Tailwind CSS y `@tailwindcss/postcss` `4.3.5`.
- ESLint `9.39.5` y `eslint-config-next` `16.4.6`.

`package.json` declara `engines.node >=22.9.0`, alineado con la metadata de npm
11.20.0 (`^20.17.0 || >=22.9.0`). La validación se ejecutó con Node.js 26.12.1.

Las versiones se consultaron con `npm view` antes de fijarlas. Se eligió
TypeScript 5.9.3 porque `typescript-eslint` declara compatibilidad con
`typescript <6.1.0`, y ESLint 9.39.5 porque los plugins que usa
`eslint-config-next` declaran compatibilidad hasta la línea 9.

## Ajustes de revisión aplicados

- La raíz quedó reducida a una sola región `<main>` con el `h1` «Consultorio
  dental» y una frase de estado local. Se retiraron badges, listas de
  tecnologías, pie repetido y textos de alcance que ya cubre el README.
- La metadata se mantiene breve: título, descripción y `noindex`.
- `typecheck` ejecuta `next typegen && tsc --noEmit` para generar las
  declaraciones de Next.js en un checkout limpio.

## Resultados desde un checkout limpio

Se eliminaron `node_modules`, `.next`, `next-env.d.ts` y `*.tsbuildinfo` antes de
la validación. Tras `npm ci`, se confirmó que `next-env.d.ts` y `.next` no
existían antes de ejecutar `typecheck`.

| Comando | Resultado | Tiempo |
|---|---|---|
| `npm.cmd ci --no-audit --no-fund` | Correcto, 360 paquetes desde el lockfile | 29,52 s |
| `npm.cmd run typecheck` | Correcto; `next typegen` generó los tipos y `tsc` no reportó errores | 4,92 s |
| `npm.cmd run lint` | Correcto, sin errores | 3,82 s |
| `npm.cmd run build` | Correcto, 3 páginas estáticas generadas | 7,71 s |
| Smoke HTTP con `npm.cmd run start -- -p 3105` | `200`, `text/html; charset=utf-8`, 6 402 bytes | — |

El smoke HTTP comprobó `lang="es-PE"`, el título «Consultorio dental», un único
`h1` con ese texto, la frase de estado local, la directiva `noindex` y una sola
región `<main>`. La compilación reportó 2,8 s de compilación, 1,840 s de
TypeScript y 600 ms de generación de páginas.

## Fallos y observaciones

- `npm install` y `npm ci` muestran una advertencia de deprecación para
  `eslint@9.39.5`: npm lo marca como fuera de soporte. No impide la instalación
  ni el lint; se mantiene por compatibilidad con los plugins de
  `eslint-config-next` 16.4.6.
- `next-env.d.ts` y `.next` son artefactos generados y están excluidos por
  `.gitignore`.
- No hubo otros fallos.

## Alcance comprobado

La base no incluye landing comercial, rutas de negocio, autenticación, Prisma,
Supabase, migraciones, shadcn/ui, pagos ni despliegues. La página de arranque no
usa CDN de fuentes ni dependencias de red en runtime y no contiene datos reales
ni inventados del consultorio.
