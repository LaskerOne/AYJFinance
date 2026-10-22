import { useEffect, useRef, useState } from "react";
import css from "./Teseracto.module.css";

/**
 * Un teseracto de verdad: los 16 vértices del hipercubo rotando en los planos
 * XW, YZ y ZW, proyectados de 4D a 3D y de ahí al plano. Nada de imágenes.
 *
 * Es el "oráculo" de la página: gira solo, palpita, oscila entre el naranja y el
 * violeta de la casa, y al hacerle clic acelera y entrega el siguiente
 * consejo. Con `prefers-reduced-motion` queda quieto pero sigue funcionando.
 */

type V4 = [number, number, number, number];

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

// Las distancias de cámara y la escala están calibradas numéricamente: en el
// peor ángulo de todo el recorrido, ningún vértice pasa de ±135 (lienzo ±150).
const D4 = 3.8; // distancia de la "cámara" 4D
const D3 = 6; // distancia de la cámara 3D
const ESCALA = 53;

function proyectar(v: V4, t: number): [number, number] {
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
  return [x3 * p3 * ESCALA, y3 * p3 * ESCALA];
}

export function Teseracto({ onClic, etiqueta }: { onClic: () => void; etiqueta: string }) {
  const [t, setT] = useState(0.6);
  const impulso = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let marco = 0;
    let previo = performance.now();
    const paso = (ahora: number) => {
      const dt = Math.min(0.05, (ahora - previo) / 1000);
      previo = ahora;
      // Velocidad de crucero + el empujón del clic, que se va apagando.
      setT((v) => v + dt * (0.55 + impulso.current));
      impulso.current *= 0.94;
      marco = requestAnimationFrame(paso);
    };
    marco = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(marco);
  }, []);

  const activar = () => {
    impulso.current = 7; // el giro de "estoy pensando"
    onClic();
  };

  const puntos = VERTICES.map((v) => proyectar(v, t));

  const linea = ([i, j]: [number, number], clase: string) => {
    const [x1, y1] = puntos[i];
    const [x2, y2] = puntos[j];
    return (
      <line
        key={`${i}-${j}`}
        x1={x1.toFixed(1)}
        y1={y1.toFixed(1)}
        x2={x2.toFixed(1)}
        y2={y2.toFixed(1)}
        className={clase}
      />
    );
  };

  return (
    <div
      className={css.caja}
      role="button"
      tabIndex={0}
      aria-label={etiqueta}
      onClick={activar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activar();
        }
      }}
    >
      <svg viewBox="-150 -150 300 300" className={css.svg} aria-hidden="true">
        {/* El cubo de w=-1 y el de w=+1 oscilan en contrafase naranja↔violeta;
            las aristas que los unen quedan en neutro. */}
        <g className={css.conectores}>
          {ARISTAS.filter(([i, j]) => (i < 8) !== (j < 8)).map((a) => linea(a, css.arista))}
        </g>
        <g className={css.cuboA}>
          {ARISTAS.filter(([i, j]) => i < 8 && j < 8).map((a) => linea(a, css.arista))}
          {puntos.slice(0, 8).map(([x, y], i) => (
            <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3} className={css.vertice} />
          ))}
        </g>
        <g className={css.cuboB}>
          {ARISTAS.filter(([i, j]) => i >= 8 && j >= 8).map((a) => linea(a, css.arista))}
          {puntos.slice(8).map(([x, y], i) => (
            <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r={3} className={css.vertice} />
          ))}
        </g>
      </svg>
    </div>
  );
}
