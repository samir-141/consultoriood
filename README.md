# Consultorio dental — base local

Base ejecutable del proyecto con Next.js (App Router), React, TypeScript estricto y
Tailwind CSS. No incluye rutas de negocio, autenticación, base de datos ni datos
reales del consultorio.

## Requisitos

- Node.js 26.12.1 (versión validada; Next.js requiere 20.9.0 o superior).
- npm 11.20.0.

En Windows con PowerShell, invoca npm como `npm.cmd`.

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

Para probar la compilación de producción:

```powershell
npm.cmd run start
```

El comando `start` requiere haber ejecutado `build` antes.
