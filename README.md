# Consultorio dental 1.0.1

Aplicación web local para recorrer la atención de un consultorio dental en Lima con datos sintéticos.

## Arranque local

Requiere Node.js 22.9 o superior y npm 11.20.0. Estos comandos funcionan en Windows con PowerShell.

```powershell
npm.cmd ci
npm.cmd run build
npm.cmd run start
```

Abre <http://127.0.0.1:3000>. Para cambiar el código con recarga automática usa `npm.cmd run dev`. Ambos modos escuchan en la interfaz local por defecto.

La primera operación que requiere persistencia inicializa PostgreSQL embebido mediante PGlite y carga datos de ejemplo. La base y la clave de enlaces se conservan en `.dental-local/`. `DENTAL_DATA_DIR` permite elegir otra ubicación para una instancia local. Ejecuta una instancia de la aplicación por directorio de datos. [Persistencia de PGlite](https://pglite.dev/docs/filesystems)

## Recorridos

- **Paciente.** Desde la landing, elige servicio, profesional y horario. El turno se retiene diez minutos al pasar a confirmación. Guarda el enlace de gestión para consultar, mover o cancelar la cita.
- **Recepción.** Consulta la agenda diaria o semanal, gestiona turnos y bloqueos, registra pacientes y revisa abonos y comprobantes.
- **Odontología.** Consulta citas y pacientes asignados. Registra atención, enmiendas, odontograma, antecedentes, consentimientos, planes y adjuntos.
- **Administración.** Consulta la auditoría clínica y registra devoluciones. La bandeja de mensajes de Recepción y Administración permite simular confirmaciones y recordatorios con enlace.

Entra desde `/ingresar`. Todas las cuentas usan la contraseña de demostración `DemoDental!101`.

| Rol | Cuenta de ejemplo |
| --- | --- |
| Administración | `admin@demo.test` |
| Recepción | `recepcion@demo.test` |
| Odontología | `odontologia@demo.test` |

## Verificación

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
npm.cmd run verify
```

`verify` arranca una instancia aislada con una base temporal. Comprueba concurrencia de turnos, vencimiento, flujos por rol, adjuntos privados, saldos y persistencia tras reiniciar.

## Puesta en marcha con el consultorio

Esta versión usa el catálogo, el equipo y los horarios de demostración, con sesiones locales y política de cancelación de prueba. Para operar con datos reales quedan pendientes la configuración de Supabase, las credenciales de producción, la entrega efectiva por Meta WhatsApp y la validación de las políticas de acceso, retención, depósitos y cancelaciones. [Alcance y pendientes](docs/progress.md)
