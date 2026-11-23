# Consultorio dental — base local

Base ejecutable del proyecto con Next.js App Router, React, TypeScript estricto y
Tailwind CSS.

## Requisitos

- Node.js 22.9.0 o superior. Versión probada: 26.12.1.
- npm 11.20.0.

En Windows con PowerShell, invoca npm como `npm.cmd`.

## Instalación

```powershell
npm.cmd ci
```

La instalación toma las versiones de `package-lock.json` y descarga las
dependencias del registro de npm. La aplicación arranca localmente con la
configuración incluida.

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

Para probar la compilación de producción, ejecuta el siguiente comando después
de `build`.

```powershell
npm.cmd run start
```
