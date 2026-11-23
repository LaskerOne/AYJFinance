# Cuentas de Dos

Tablero de finanzas de pareja: presupuesto, movimientos reales, deudas, metas,
crédito, patrimonio e histórico, sincronizado en vivo entre dos personas.
React 18 + TypeScript + Vite al frente, Supabase (Postgres + Auth + Realtime)
detrás. No hay servidor propio que mantener.

## Comandos

```bash
npm run dev        # Vite en 127.0.0.1:5173
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + compilación a dist/
npm run preview    # sirve dist/
npm run lint       # ESLint (typescript-eslint + reglas de hooks)
npm test           # Vitest, una pasada
npm run test:watch # Vitest en modo observador
```

Antes de dar por terminado un cambio: `npm run lint`, `npm test` y
`npm run build`. El workflow `.github/workflows/calidad.yml` corre lo mismo
en cada push y PR.

Claude Code tiene un hook `Stop` (`.claude/settings.json` →
`.claude/hooks/verificar.mjs`): al terminar cada turno, si hay cambios sin
commit en `src/` o en la configuración, corre lint y pruebas, y si fallan
devuelve el error para que se corrija antes de entregar. Solo bloquea una vez
por turno, para no quedar en un ciclo.

**Excepción al "todo en español":** los hooks de React se nombran `useAlgo`,
no `usarAlgo`. React y ESLint reconocen un hook solo por ese prefijo; sin él,
las reglas de hooks no lo revisan.

## Pruebas

- Cubren `src/lib/` (cálculo puro). Cada `x.ts` tiene su `x.test.ts` al lado.
- Las filas de dominio salen de `src/pruebas/fabricas.ts`: cada prueba
  declara solo los campos que le importan.
- Una fórmula nueva en `src/lib/` llega con sus pruebas en el mismo cambio.
  Prioriza invariantes (lo que le queda a cada uno suma lo libre del hogar;
  avalancha nunca paga más interés que bola) sobre ejemplos sueltos.
- Hoy tienen pruebas `calculos`, `deudas`, `liquidacion`, `formato`,
  `oraculo`, `categorizar`, `proyeccion` y `listas`. Los demás módulos de
  `lib` no tienen todavía.
- Lo que depende de la fecha recibe `hoy` como argumento; las pruebas lo fijan
  siempre. Una prueba que usa la fecha del sistema falla el día menos pensado.

## Arquitectura: el dato de abajo hacia arriba

1. **`supabase/migrations/*.sql`** — esquema, políticas RLS y funciones.
   Es la fuente de verdad; todo lo demás la refleja.
2. **`src/models/dominio.ts`** — tipos que reflejan *exactamente* esas tablas,
   más los catálogos (`CATEGORIAS`, `CATEGORIAS_INGRESO`) y el mapa
   `NombreTabla → fila`. Si cambia una tabla, este archivo cambia con ella.
3. **`src/services/`** — frontera con Supabase. `supabase.ts` crea el único
   cliente y traduce errores a frases accionables (`mensajeDeError`);
   `coleccion.service.ts` hace el CRUD genérico por tabla;
   `hogar.service.ts` resuelve el hogar y sus integrantes.
4. **`src/contexts/`** — `SesionContext` (auth, enlace mágico) envuelve a
   `HogarContext`, que carga las nueve tablas del hogar y las mantiene al día
   por Realtime. Es el único lugar que guarda estado del servidor.
5. **`src/lib/`** — cálculo puro: sin React, sin Supabase, sin fechas del
   sistema salvo que se pasen como argumento. `calculos.ts` es el núcleo;
   el resto son dominios (`deudas`, `credito`, `patrimonio`, `proyeccion`,
   `salud`, `liquidacion`, `oraculo`…).
6. **`src/hooks/`** — pegan 4 y 5 con `useMemo`. `useFinanzas` es el ejemplo
   canónico: lee del contexto, delega en `lib/calculos`, memoriza.
7. **`src/Pages/` y `src/components/`** — presentación. Una carpeta por
   pantalla; los subcomponentes propios de una pantalla viven dentro de ella.

**Regla que sostiene todo esto:** ninguna fórmula financiera se escribe dentro
de un componente. Va a `src/lib/` como función pura y el componente la consume
por un hook. Es lo que mantiene el cálculo verificable y reutilizable entre
pantallas.

## Convenciones

- **Todo en español**: archivos, componentes, variables, tipos y comentarios.
  Los comentarios explican *por qué*, no *qué* (ver `vite.config.ts` o
  `services/supabase.ts` como referencia del tono).
- Alias `@/` → `src/`. No usar rutas relativas que suban de carpeta.
- CSS Modules por pantalla (`X.module.css`). Los colores, espacios y tipografía
  salen de las variables de `src/styles/tokens.css` — nunca valores sueltos.
- **Sin librerías de UI ni de gráficos.** Los charts de
  `src/components/charts/` son SVG escrito a mano. Agregar una dependencia es
  una decisión explícita, no un atajo.
- Componentes exportados con `export function`, no `export default`.

## Base de datos

- Migraciones numeradas y **inmutables**: para corregir algo se agrega
  `00NN_descripcion.sql`, no se edita una existente.
- RLS protege todo: cada fila pertenece a un `hogar_id` y las políticas filtran
  por los integrantes de ese hogar. Un cambio de esquema sin su política es un
  bug de seguridad.
- La clave `anon` es pública por diseño. **Nunca** poner `service_role` en el
  frontend ni en `.env` del repo.
- Al agregar una tabla hay que tocar, en este orden: migración → `dominio.ts`
  (`MapaTablas` y `NombreTabla`) → lista `TABLAS` de `HogarContext`.

## Al trabajar aquí

- Cambios que toquen esquema + tipos + varias pantallas: dilo antes de empezar,
  en dos líneas, y propón la versión por fases. Cada fase debe dejar la app
  completa y usable.
- La rama de trabajo es `v2`; `main` es la base para PRs.
