# CLAUDE.md — Sistema Velasco (React)

> Instrucciones permanentes para Claude Code en este repo. Conciso a propósito:
> el detalle de arquitectura vive en `docs/ARQUITECTURA.md`.

## Qué es este proyecto

App interna de gestión para Metalúrgica Velasco (taller metalúrgico de ~18 personas).
Reescritura en React de un sistema que antes era HTML + JS vanilla. Es **una sola app
unificada**: proyectos, tablero de planificación, matriz de productos, recursos, etc.,
con navegación interna (sin páginas separadas).

La fuente de verdad de las decisiones de arquitectura es `docs/ARQUITECTURA.md`. Leé ese
archivo para el detalle; este CLAUDE.md es solo el resumen operativo.

## Stack

- React + Vite + TypeScript
- Supabase (PostgreSQL + Auth + Storage) vía cliente Supabase
- Hosting: Vercel (auto-deploy desde GitHub en cada push)

## Comandos

- Instalar dependencias: `npm install`
- Servidor de desarrollo: `npm run dev`
- Build de producción: `npm run build`

## Estructura del proyecto

Organización **por feature**: cada módulo en su carpeta dentro de `src/features/`, y lo
compartido en `src/shared/` (`components/`, `lib/`, `types/`). Detalle en
`docs/ARQUITECTURA.md` (§12).

## Convenciones de base de datos

- Tablas en **plural** (`personal`, `empresas`, `proyectos`).
- Foreign keys en **singular** (`empresa_id`, `personal_id`).
- Tablas auxiliares con **prefijo de módulo** (`personal_vacaciones`, `empresa_contactos`).

## Principio fundacional

La app modela **el negocio del taller**, no los conceptos de ningún ERP externo
(TacticaSoft, Oppen, Odoo). Toda integración con un sistema externo pasa por una **capa
adaptadora** (traductora). El código de la app nunca usa el vocabulario del ERP. **No
modelar nada "como en Táctica".**

## Cómo trabajar

- Comunicación en **español**.
- Confirmá decisiones de arquitectura/diseño antes de implementar cambios grandes.
- Si ves un problema potencial en lo que se pide, advertilo **antes** de aplicarlo.
- Quien programa está **aprendiendo React y TypeScript**: explicá brevemente los conceptos
  nuevos y el porqué de las decisiones, no solo el qué.
- Editar por cambios puntuales (diffs) está bien, es lo normal acá. Si se pide ver un
  archivo completo para entenderlo, mostralo.

## Git / commits

- **No firmar los commits.** No agregar la línea `Co-Authored-By` ni ninguna firma de
  Claude en los mensajes de commit. Solo el mensaje descriptivo.
