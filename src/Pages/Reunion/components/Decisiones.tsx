import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import type { Decision } from "@/models/dominio";
import css from "../Reunion.module.css";

/**
 * Lista editable de decisiones de un mes: qué acordaron, quién se encarga y
 * si ya se cumplió. Una fila por decisión, así los dos pueden editar a la vez.
 */
export function Decisiones({ lista, soloMarcar = false }: { lista: Decision[]; soloMarcar?: boolean }) {
  const { editar, borrar } = useHogar();

  return (
    <ul className={css.decisiones}>
      {lista.map((d) => (
        <li key={d.id} className={css.decision} data-cumplida={d.cumplida}>
          <input
            type="checkbox"
            aria-label="Cumplida"
            checked={d.cumplida}
            onChange={(e) => void editar("decisiones", d.id, { cumplida: e.target.checked })}
          />
          {soloMarcar ? (
            <span className={css.decisionTexto}>{d.texto || "Sin texto"}</span>
          ) : (
            <input
              className={css.decisionCampo}
              aria-label="Decisión"
              placeholder="Ej. Abonar la prima a la tarjeta"
              defaultValue={d.texto}
              onBlur={(e) => e.target.value !== d.texto && void editar("decisiones", d.id, { texto: e.target.value })}
            />
          )}
          <SelectorPersona
            valor={d.responsable}
            etiqueta="Quién se encarga"
            textoComun="Los dos"
            onCambio={(v) => void editar("decisiones", d.id, { responsable: v })}
          />
          {!soloMarcar && (
            <button className="borrar" aria-label="Eliminar decisión" onClick={() => void borrar("decisiones", d.id)}>
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
