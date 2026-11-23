# Consultorio dental — base local

Base ejecutable del proyecto con Next.js (App Router), React, TypeScript estricto y
Tailwind CSS. No incluye rutas de negocio, autenticación, base de datos ni datos
reales del consultorio.

## Requisitos

- Node.js 26.12.1, versión probada para esta base.
- npm 11.20.0.

`package.json` declara `engines.node >=22.9.0`, el rango coherente con la metadata
de npm 11.20.0 (`^20.17.0 || >=22.9.0`). En Windows con PowerShell, invoca npm
como `npm.cmd`.

## Instalación

```powershell
npm.cmd ci
```

La instalación usa `package-lock.json` y no necesita variables de entorno ni
servicios remotos.

## Desarrollo

```powershell
npm.cmd run dev
```

La aplicación queda disponible en <http://localhost:3000>.

## Validación

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

`typecheck` ejecuta `next typegen` antes de `tsc --noEmit` para generar las
declaraciones de Next.js en un checkout limpio.

Para probar la compilación de producción:

```powershell
npm.cmd run start
```

El comando `start` requiere haber ejecutado `build` antes.
