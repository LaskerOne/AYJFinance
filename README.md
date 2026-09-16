# Cuentas de Dos

Tablero de finanzas para una pareja: presupuesto, movimientos reales, deudas,
metas e histórico mensual, sincronizado en vivo entre los dos.

- **Frontend:** React 18 + TypeScript + Vite, sin librerías de UI ni de gráficos.
- **Backend:** Supabase (Postgres + Auth + Realtime). No hay servidor propio que mantener.
- **Hosting:** cualquier host estático. Las instrucciones de abajo son para Vercel.

---

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) y crea un proyecto gratuito.
   Elige la región más cercana (para Colombia, `us-east-1`).
2. Abre **SQL Editor → New query** y ejecuta, en este orden:
   - `supabase/migrations/0001_esquema.sql` — tablas, políticas RLS y tiempo real.
   - `supabase/migrations/0002_funciones.sql` — sembrado de ejemplo, cierre de mes
     y aprendizaje de reglas.
3. Ve a **Project Settings → API** y copia:
   - `Project URL`
   - `anon public` key

> La clave `anon` es pública por diseño y no da acceso a nada por sí sola: quien
> protege los datos son las políticas RLS de la migración 0001. **Nunca** uses
> aquí la `service_role` key.

### Configurar el enlace mágico

En **Authentication → URL Configuration**:

- `Site URL`: `http://localhost:5173` mientras desarrollas, y la URL de Vercel
  cuando despliegues.
- `Redirect URLs`: agrega ambas.

En **Authentication → Providers → Email**, deja *Enable Email provider*
encendido y *Confirm email* apagado (el enlace mágico ya confirma).

El correo de cortesía de Supabase sirve para empezar, pero está limitado a unos
pocos envíos por hora. Si les queda corto, conecten un SMTP propio en
**Project Settings → Auth → SMTP Settings** (Resend y Brevo tienen capa gratuita).

---

## 2. Correr en local

```bash
npm install
cp .env.example .env    # y pega la URL y la clave anónima
npm run dev
```

Abre `http://localhost:5173`, escribe tu correo y entra con el enlace que llega.
La primera vez se crea el hogar y se siembra con un presupuesto de ejemplo que
puedes borrar fila por fila.

Otros comandos:

```bash
npm run build       # verifica tipos y compila a dist/
npm run typecheck   # solo la verificación de tipos
npm run preview     # sirve dist/ localmente
```

---

## 3. Invitar a tu pareja

En **Ajustes → Quiénes entran**, escribe su correo y autoriza el acceso. Ella
entra a la misma dirección, pide su enlace mágico con ese correo, y cae directo
en el hogar de los dos. Desde ese momento los cambios de uno aparecen en la
pantalla del otro sin recargar.

El acceso es total y simétrico: quien entra ve y edita todo. No hay cuentas
separadas ni información oculta entre los dos.

---

## 4. Desplegar en Vercel

1. Sube el repositorio a GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project**, importa el repo.
   Vercel detecta Vite solo; el `vercel.json` ya trae el *rewrite* que hace falta
   para que las rutas del navegador no den 404.
3. En **Settings → Environment Variables**, agrega:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Despliega. Copia la URL final y agrégala en Supabase como `Site URL` y como
   `Redirect URL`, o el enlace mágico devolverá a localhost.

Cada `git push` vuelve a desplegar.

---

## 5. Evitar que Supabase pause el proyecto

Los proyectos del plan gratuito **se pausan tras una semana sin actividad**. No se
pierde nada, pero hay que entrar al panel y reactivarlos a mano — y un tablero de
finanzas se abre cada tanto, no a diario.

El repositorio trae `.github/workflows/mantener-despierto.yml`, que hace una
consulta mínima cada tres días y mantiene el reloj de inactividad en cero. Para
activarlo, agrega dos secretos en **Settings → Secrets and variables → Actions**:

| Secreto | Valor |
|---|---|
| `SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | la clave anónima del proyecto |

Son los mismos dos valores del `.env`. Con la CLI de GitHub:

```bash
gh secret set SUPABASE_URL
gh secret set SUPABASE_ANON_KEY
```

Puedes probarlo sin esperar tres días: pestaña **Actions → Mantener Supabase
despierto → Run workflow**.

Dos advertencias sobre los cron de GitHub Actions, para que no te tomen por
sorpresa:

- **Se desactivan solos** si el repositorio pasa 60 días sin commits. GitHub avisa
  por correo antes; basta un clic para reactivarlos.
- **No son puntuales.** Un cron programado puede ejecutarse con bastante retraso
  cuando la cola está congestionada. Por eso el intervalo es de tres días y no de
  seis: hay margen de sobra antes de que se cumpla la semana.

---

## 6. Cómo está organizado

```
src/
├── components/          UI transversal
│   ├── ui/              piezas genéricas (Kpi, CampoMoneda, Etiqueta…)
│   ├── charts/          gráficos en SVG, sin librerías
│   ├── layout/          marco de la aplicación
│   └── ProtectedRoute   guarda de rutas autenticadas
├── contexts/            SesionContext (auth) · HogarContext (datos + realtime)
├── hooks/               useFinanzas · useMoneda
├── lib/                 cálculo puro: formato, finanzas, amortización
├── models/              tipos de dominio, espejo del esquema SQL
├── Pages/[Modulo]/      una carpeta por sección, con components/ propio
├── services/            Supabase, hogar, colecciones, lectura de CSV
└── styles/              tokens.css (sistema de diseño) + global.css
```

Tres decisiones que vale la pena conocer antes de tocar el código:

**El cálculo está separado de la pantalla.** Todo el motor financiero vive en
`lib/calculos.ts` y `lib/deudas.ts` como funciones puras: mismos datos, mismo
resultado, sin tocar el DOM ni la red. Se pueden probar sin montar React.

**Un solo canal de tiempo real.** `HogarContext` abre un canal de Supabase y
escucha las siete tablas filtradas por `hogar_id`. Las escrituras pintan primero
en pantalla y después confirman contra el servidor, así que la interfaz nunca
espera al servidor para responder.

**El color nace en `tokens.css`.** Ningún componente escribe un hex. La paleta
está verificada para daltonismo (separación CVD ΔE ≥ 8 entre colores vecinos) y
contraste (≥ 3:1 contra el fondo), en tema claro y oscuro por separado. Si vas a
cambiar colores, cámbialos ahí y vuelve a verificar.

---

## 7. Seguridad

Todas las tablas tienen *Row Level Security* activo y la misma regla: solo ve y
escribe quien es miembro del hogar, comprobado con la función `es_miembro()`.
Sin sesión válida no se lee ni una fila, aunque alguien tenga la URL y la clave
anónima.

La función es `SECURITY DEFINER` a propósito: sin eso, la política de la tabla
`miembros` se consultaría a sí misma y Postgres entraría en recursión infinita.

---

## 8. Qué falta por hacer

Ideas que el esquema ya soporta y que no están construidas todavía:

- **Recordatorios de pago.** La tabla `deudas` guarda `dia_pago`; falta una Edge
  Function programada que avise antes del corte.
- **Cierre automático de mes.** Hoy el cierre se dispara con un botón en
  Histórico. Un cron de Supabase podría hacerlo el día 1 de cada mes.
- **Adjuntar soportes.** Supabase Storage permitiría colgarle una foto del recibo
  a cada movimiento.
- **Pruebas.** `lib/calculos.ts` y `lib/deudas.ts` son funciones puras: son el
  lugar natural para empezar con Vitest.
