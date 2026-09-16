import css from "./Cargando.module.css";

export function Cargando({ mensaje = "Cargando" }: { mensaje?: string }) {
  return (
    <div className={css.caja} role="status" aria-live="polite">
      <span className={css.punto} />
      <span className={css.punto} />
      <span className={css.punto} />
      <p className={css.texto}>{mensaje}…</p>
    </div>
  );
}
