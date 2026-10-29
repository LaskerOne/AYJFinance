import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import css from "./Teseracto.module.css";

/**
 * Un teseracto de verdad: los 16 vértices del hipercubo rotando en los planos
 * XW, YZ y ZW, proyectados de 4D a 3D y de ahí al plano. Nada de imágenes.
 *
 * Es el "oráculo" de la página: gira solo dentro de una esfera de vidrio,
 * palpita, oscila entre el naranja y el violeta de la casa, y al hacerle clic
 * acelera y entrega el siguiente consejo. La profundidad se lee en el trazo:
 * lo cercano es grueso y brillante, lo lejano delgado y tenue. Con el mouse
 * encima se enciende como neón y la escena se inclina hacia el puntero.
 * Con `prefers-reduced-motion` queda quieto pero sigue funcionando.
 */

type V4 = [number, number, number, number];
/** Punto proyectado: x, y en el lienzo y su cercanía (más es más cerca). */
type Punto = [number, number, number];

const VERTICES: V4[] = Array.from({ length: 16 }, (_, i) => [
  i & 1 ? 1 : -1,
  i & 2 ? 1 : -1,
  i & 4 ? 1 : -1,
  i & 8 ? 1 : -1,
]);

// Dos vértices se conectan cuando difieren en exactamente una coordenada.
const ARISTAS: Array<[number, number]> = [];
for (let i = 0; i < 16; i++) {
  for (let b = 0; b < 4; b++) {
    const j = i ^ (1 << b);
    if (j > i) ARISTAS.push([i, j]);
  }
}
const CONECTORES = ARISTAS.filter(([i, j]) => (i < 8) !== (j < 8));
const ARISTAS_A = ARISTAS.filter(([i, j]) => i < 8 && j < 8);
const ARISTAS_B = ARISTAS.filter(([i, j]) => i >= 8 && j >= 8);

// Las distancias de cámara y la escala están calibradas numéricamente: en el
// peor ángulo de todo el recorrido, ningún vértice pasa de ±135, dentro de
// la esfera de radio 165.
const D4 = 3.8; // distancia de la "cámara" 4D
const D3 = 6; // distancia de la cámara 3D
const ESCALA = 53;
const RADIO = 165;

function proyectar(v: V4, t: number): Punto {
  let [x, y, z, w] = v;
  const a = t * 0.52; // plano XW
  const b = t * 0.31; // plano YZ
  const c = t * 0.19; // plano ZW

  let r1 = x * Math.cos(a) - w * Math.sin(a);
  let r2 = x * Math.sin(a) + w * Math.cos(a);
  x = r1;
  w = r2;

  r1 = y * Math.cos(b) - z * Math.sin(b);
  r2 = y * Math.sin(b) + z * Math.cos(b);
  y = r1;
  z = r2;

  r1 = z * Math.cos(c) - w * Math.sin(c);
  r2 = z * Math.sin(c) + w * Math.cos(c);
  z = r1;
  w = r2;

  const p4 = D4 / (D4 - w);
  const x3 = x * p4;
  const y3 = y * p4;
  const z3 = z * p4;
  const p3 = D3 / (D3 - z3);
  return [x3 * p3 * ESCALA, y3 * p3 * ESCALA, p3];
}

/** Cercanía (≈0,6 a ≈1,6) llevada a 0–1 para grosor y brillo. */
const cerca = (p: number) => Math.max(0, Math.min(1, (p - 0.65) / 0.9));

// La malla de la esfera: paralelos fijos (la esfera está inclinada hacia el
// que mira) y meridianos que giran despacio alrededor del eje vertical.
const INCLINACION = 0.38;
const PARALELOS = [-60, -30, 0, 30, 60].map((g) => (g * Math.PI) / 180);
const MERIDIANOS = 6;

function malla(giro: number) {
  const paralelos = PARALELOS.map((lat) => ({
    cy: RADIO * Math.sin(lat) * Math.cos(INCLINACION),
    rx: RADIO * Math.cos(lat),
    ry: RADIO * Math.cos(lat) * Math.sin(INCLINACION),
  }));
  const meridianos = Array.from({ length: MERIDIANOS }, (_, k) => {
    const angulo = giro + (k * Math.PI) / MERIDIANOS;
    // De frente se ven anchos y brillantes; de canto, finos y tenues.
    return { rx: Math.abs(Math.sin(angulo)) * RADIO, frente: Math.cos(angulo) > 0 };
  });
  return { paralelos, meridianos };
}

// --- polvo estelar ------------------------------------------------------------
// Al hacer clic, el teseracto suelta una nube de partículas que salen de su
// centro, frenan, flotan apenas hacia arriba y titilan mientras se apagan.

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Segundos que lleva viva y los que vive en total. */
  edad: number;
  vida: number;
  r: number;
  color: string;
  /** Los destellos son estrellitas de cuatro puntas; el resto, polvo. */
  destello: boolean;
  fase: number;
}

const COLORES_POLVO = ["var(--marca-naranja)", "var(--marca-violeta)", "#fff", "#ffd29a", "#cfc4ff"];
const CANTIDAD_POLVO = 90;

function soltarPolvo(): Particula[] {
  return Array.from({ length: CANTIDAD_POLVO }, () => {
    const angulo = Math.random() * Math.PI * 2;
    // Con este freno una partícula recorre hasta rapidez/1,4: casi todas
    // cruzan el borde de la esfera (radio 165) y unas pocas se quedan adentro.
    const rapidez = 150 + Math.random() * 400;
    const desde = Math.random() * 38;
    const destello = Math.random() < 0.22;
    return {
      x: Math.cos(angulo) * desde,
      y: Math.sin(angulo) * desde,
      vx: Math.cos(angulo) * rapidez,
      vy: Math.sin(angulo) * rapidez,
      edad: 0,
      vida: 1.1 + Math.random() * 1.5,
      r: destello ? 4 + Math.random() * 3.5 : 1 + Math.random() * 2.4,
      color: COLORES_POLVO[Math.floor(Math.random() * COLORES_POLVO.length)],
      destello,
      fase: Math.random() * Math.PI * 2,
    };
  });
}

/** Avanza cada partícula `dt` segundos y descarta las que ya se apagaron. */
function moverPolvo(polvo: Particula[], dt: number): Particula[] {
  const freno = Math.exp(-dt * 1.4);
  return polvo
    .map((p) => ({
      ...p,
      x: p.x + p.vx * dt,
      y: p.y + p.vy * dt,
      vx: p.vx * freno,
      // Frena y además flota hacia arriba, como polvo que se eleva.
      vy: p.vy * freno - 26 * dt,
      edad: p.edad + dt,
    }))
    .filter((p) => p.edad < p.vida);
}

/** Estrella de cuatro puntas centrada en el origen. */
function estrella(r: number): string {
  const c = r * 0.22;
  return `M0 ${-r} L${c} ${-c} L${r} 0 L${c} ${c} L0 ${r} L${-c} ${c} L${-r} 0 L${-c} ${-c} Z`;
}

/** Inclina la escena hacia el puntero. Con reduced-motion no hace nada. */
function inclinar(e: MouseEvent<HTMLDivElement>) {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const caja = e.currentTarget.getBoundingClientRect();
  const px = (e.clientX - caja.left) / caja.width - 0.5;
  const py = (e.clientY - caja.top) / caja.height - 0.5;
  e.currentTarget.style.setProperty("--rx", `${(-py * 16).toFixed(2)}deg`);
  e.currentTarget.style.setProperty("--ry", `${(px * 20).toFixed(2)}deg`);
}

function enderezar(e: MouseEvent<HTMLDivElement>) {
  e.currentTarget.style.setProperty("--rx", "0deg");
  e.currentTarget.style.setProperty("--ry", "0deg");
}

export function Teseracto({ onClic, etiqueta }: { onClic: () => void; etiqueta: string }) {
  const [t, setT] = useState(0.6);
  const impulso = useRef(0);
  const encima = useRef(false);
  const polvo = useRef<Particula[]>([]);
  /** Segundos desde el último clic, para la onda expansiva (null: ninguna). */
  const onda = useRef<number | null>(null);
  const id = useId();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let marco = 0;
    let previo = performance.now();
    const paso = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - previo) / 1000);
      previo = ahora;
      // Velocidad de crucero (un poco más viva con el mouse encima) + el
      // empujón del clic, que se va apagando.
      setT((v) => v + dt * ((encima.current ? 0.85 : 0.55) + impulso.current));
      impulso.current *= 0.94;
      if (polvo.current.length > 0) polvo.current = moverPolvo(polvo.current, dt);
      if (onda.current !== null) onda.current = onda.current + dt > 0.9 ? null : onda.current + dt;
      marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, []);

  const activar = () => {
    impulso.current = 7; // el giro de "estoy pensando"
    // Con movimiento reducido no corre la animación: no hay polvo que soltar.
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      polvo.current = [...polvo.current, ...soltarPolvo()];
      onda.current = 0;
    }
    onClic();
  };

  const puntos = VERTICES.map((v) => proyectar(v, t));
  const { paralelos, meridianos } = malla(t * 0.18);

  // De atrás hacia adelante, para que lo cercano tape a lo lejano.
  const lineas = (aristas: Array<[number, number]>, clase: string) =>
    aristas
      .map(([i, j]) => ({ i, j, p: cerca((puntos[i][2] + puntos[j][2]) / 2) }))
      .sort((a, b) => a.p - b.p)
      .map(({ i, j, p }) => (
        <line
          key={`${i}-${j}`}
          x1={puntos[i][0].toFixed(1)}
          y1={puntos[i][1].toFixed(1)}
          x2={puntos[j][0].toFixed(1)}
          y2={puntos[j][1].toFixed(1)}
          className={clase}
          style={{ ["--p" as string]: p.toFixed(2) }}
        />
      ));

  const vertices = (desde: number) =>
    puntos.slice(desde, desde + 8).map(([x, y, prof], k) => {
      const p = cerca(prof);
      return (
        <circle
          key={k}
          cx={x.toFixed(1)}
          cy={y.toFixed(1)}
          r={(1.8 + p * 2.8).toFixed(2)}
          className={css.vertice}
          style={{ ["--p" as string]: p.toFixed(2) }}
        />
      );
    });

  return (
    <div
      className={css.caja}
      role="button"
      tabIndex={0}
      aria-label={etiqueta}
      onClick={activar}
      onMouseEnter={() => (encima.current = true)}
      onMouseMove={inclinar}
      onMouseLeave={(e) => {
        encima.current = false;
        enderezar(e);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activar();
        }
      }}
    >
      <div className={css.escena}>
        <svg viewBox="-200 -200 400 420" className={css.svg} aria-hidden="true">
          <defs>
            {/* Vidrio: casi transparente al centro y luminoso en el borde,
                como una burbuja vista de frente. */}
            <radialGradient id={`${id}-vidrio`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--marca-violeta)" stopOpacity="0.05" />
              <stop offset="70%" stopColor="var(--marca-violeta)" stopOpacity="0.08" />
              <stop offset="92%" stopColor="var(--marca-naranja)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--marca-naranja)" stopOpacity="0.34" />
            </radialGradient>
            <radialGradient id={`${id}-reflejo`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </radialGradient>
            <radialGradient id={`${id}-sombra`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--marca-violeta)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--marca-violeta)" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* La sombra en el piso: ancla la esfera en un espacio. */}
          <ellipse cx="0" cy="198" rx="130" ry="16" fill={`url(#${id}-sombra)`} className={css.sombra} />

          <g className={css.esfera}>
            <circle r={RADIO} fill={`url(#${id}-vidrio)`} />
            <g className={css.malla}>
              {paralelos.map((p, k) => (
                <ellipse key={`p${k}`} cy={p.cy.toFixed(1)} rx={p.rx.toFixed(1)} ry={p.ry.toFixed(1)} />
              ))}
              {meridianos.map((m, k) => (
                <ellipse
                  key={`m${k}`}
                  rx={m.rx.toFixed(1)}
                  ry={RADIO}
                  className={m.frente ? css.meridianoFrente : css.meridianoAtras}
                />
              ))}
            </g>
            <circle r={RADIO} className={css.borde} />
          </g>

          {/* El cubo de w=-1 y el de w=+1 oscilan en contrafase naranja↔violeta;
              las aristas que los unen quedan en neutro. */}
          <g className={css.conectores}>{lineas(CONECTORES, css.arista)}</g>
          <g className={css.cuboA}>
            {lineas(ARISTAS_A, css.arista)}
            {vertices(0)}
          </g>
          <g className={css.cuboB}>
            {lineas(ARISTAS_B, css.arista)}
            {vertices(8)}
          </g>

          {/* La onda expansiva del clic: sale del borde de la esfera y se apaga. */}
          {onda.current !== null && (
            <circle
              r={(RADIO * (0.85 + onda.current * 0.75)).toFixed(1)}
              className={css.onda}
              style={{ opacity: Math.max(0, 1 - onda.current / 0.9).toFixed(2) }}
            />
          )}

          {/* El polvo estelar: se apaga con la edad y titila mientras tanto. */}
          {polvo.current.length > 0 && (
            <g className={css.polvo}>
              {polvo.current.map((p, k) => {
                const resta = 1 - p.edad / p.vida;
                const titila = 0.55 + 0.45 * Math.sin(p.fase + p.edad * 18);
                const opacidad = (resta * titila).toFixed(2);
                return p.destello ? (
                  <path
                    key={k}
                    d={estrella(p.r * (0.6 + resta * 0.4))}
                    transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${((p.fase + p.edad * 2) * 57.3).toFixed(0)})`}
                    fill={p.color}
                    opacity={opacidad}
                  />
                ) : (
                  <circle key={k} cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={p.r.toFixed(2)} fill={p.color} opacity={opacidad} />
                );
              })}
            </g>
          )}

          {/* El reflejo de la luz sobre el vidrio, encima de todo. */}
          <ellipse cx="-62" cy="-98" rx="58" ry="30" transform="rotate(-32 -62 -98)" fill={`url(#${id}-reflejo)`} className={css.reflejo} />
        </svg>
      </div>
    </div>
  );
}
