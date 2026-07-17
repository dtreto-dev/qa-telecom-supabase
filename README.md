# QA & Database Security: Auditoría de RLS y Consistencia de Negocio (Supabase + Node.js)

Este repositorio contiene el proyecto de auditoría funcional, seguridad a nivel de base de datos e integración de datos para un sistema de gestión interna de telecomunicaciones. El foco principal fue asegurar la consistencia en los flujos de negocio y blindar la trazabilidad operativa de la plataforma.

---

## 🎯 Escenario y Objetivos

La plataforma gestiona el trabajo de técnicos en terreno (agenda, cierre de órdenes) y el inventario de materiales (serializados como Routers ONT y no serializados como cable de fibra).

El objetivo de esta auditoría de QA fue:

1. **Evitar inconsistencias de negocio:** Bloquear el cierre de órdenes de servicio en fechas futuras.
2. **Garantizar la inmutabilidad de la auditoría:** Corregir políticas de seguridad por fila (RLS) en Supabase para asegurar el correcto logueo de actividades operativas en la bitácora (`historial_actividades`).
3. **Validar la lógica de inventario:** Asegurar que los componentes serializados exijan números de serie únicos y que los materiales globales se descuenten correctamente.

---

## 🛠️ Stack Tecnológico

- **Base de Datos & Seguridad:** Supabase / PostgreSQL (Triggers, Functions, RLS)
- **Backend & Simulación de Pruebas:** Node.js
- **Reportabilidad:** Markdown (Reporte Ejecutivo de Hallazgos)

---

## 📂 Estructura del Proyecto

- `/database`: Contiene los scripts de inicialización de tablas (`schema.sql`) y las reglas de seguridad físicas de la base de datos (`triggers.sql`).
- `/tests`: Scripts en Node.js que simulan las peticiones del técnico, interactúan con Supabase y validan el comportamiento esperado.
- `/docs`: Reporte ejecutivo detallado de hallazgos para entrega formal al cliente.

---

## 🚀 Implementación Técnica Destacada

### 1. Validación Temporal en Base de Datos (Anti-Scrap / Inconsistencia)

Se programó un Trigger en PL/pgSQL que evalúa que la fecha de ejecución de una orden no sea superior a la fecha actual antes de confirmar un cambio a estado `Completada`:

```sql
CREATE OR REPLACE FUNCTION validar_fecha_cierre()
RETURNS TRIGGER AS $$ BEGIN     IF NEW.estado = 'Completada' AND NEW.fecha_programada > CURRENT_DATE THEN         RAISE EXCEPTION 'No se puede completar una orden cuya fecha programada es futura.';     END IF;     RETURN NEW; END; $$ LANGUAGE plpgsql;
```
