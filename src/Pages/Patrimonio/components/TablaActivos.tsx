import { CampoMoneda } from "@/components/ui/CampoMoneda";
import { SelectorPersona } from "@/components/ui/SelectorPersona";
import { useHogar } from "@/contexts/HogarContext";
import { useMoneda } from "@/hooks/useMoneda";
import { aNumero } from "@/lib/formato";
import { TIPOS_ACTIVO, type TipoActivo } from "@/models/dominio";

const TIPOS = Object.keys(TIPOS_ACTIVO) as TipoActivo[];

/** Lo que tienen, editable en línea como las demás tablas de la app. */
export function TablaActivos() {
  const { activos, crear, editar, borrar } = useHogar();
  const { $ } = useMoneda();
  const total = activos.reduce((s, a) => s + Number(a.valor), 0);

  return (
    <section className="panel">
      <header>
        <div>
          <h2>Lo que tienen</h2>
          <p className="nota">
            Cuentas, inversiones, cesantías, pensión y bienes, con su valor de hoy. La
            rentabilidad es la E.A. que pactaron o esperan; en un carro puede ser negativa (se
            deprecia). El aporte es lo que le meten cada mes.
          </p>
        </div>
      </header>

      <div className="tablaScroll">
        <table className="datos" style={{ minWidth: 900 }}>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Tipo</th>
              <th>De quién</th>
              <th className="r">Valor hoy</th>
              <th className="r">Rentab. % E.A.</th>
              <th className="r">Aporte / mes</th>
              <th>Vence</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {activos.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <p className="vacio">
                    Todavía no hay nada registrado. Empiecen por la cuenta donde está el colchón y
                    el saldo de cesantías y pensión que dice el extracto.
                  </p>
                </td>
              </tr>
            )}
            {activos.map((a) => (
              <tr key={a.id}>
                <td>
                  <input
                    aria-label="Nombre del activo"
                    defaultValue={a.nombre}
                    placeholder="Ej. CDT a 6 meses"
                    onBlur={(e) => e.target.value !== a.nombre && void editar("activos", a.id, { nombre: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    aria-label="Tipo"
                    value={a.tipo}
                    onChange={(e) => void editar("activos", a.id, { tipo: e.target.value })}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {TIPOS_ACTIVO[t].nombre}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <SelectorPersona
                    valor={a.usuario_id}
                    etiqueta="De quién es"
                    onCambio={(v) => void editar("activos", a.id, { usuario_id: v })}
                  />
                </td>
                <td className="r">
                  <CampoMoneda valor={Number(a.valor)} etiqueta="Valor de hoy" onCambio={(v) => void editar("activos", a.id, { valor: v })} />
                </td>
                <td className="r">
                  <input
                    className="n"
                    inputMode="decimal"
                    aria-label="Rentabilidad efectiva anual"
                    placeholder="—"
                    defaultValue={a.tasa_ea === null ? "" : String(a.tasa_ea).replace(".", ",")}
                    onBlur={(e) => {
                      const t = e.target.value.trim();
                      const v = t === "" ? null : aNumero(t);
                      if (v !== a.tasa_ea) void editar("activos", a.id, { tasa_ea: v });
                    }}
                  />
                </td>
                <td className="r">
                  <CampoMoneda valor={Number(a.aporte_mensual)} etiqueta="Aporte mensual" onCambio={(v) => void editar("activos", a.id, { aporte_mensual: v })} />
                </td>
                <td>
                  <input
                    type="date"
                    aria-label="Fecha de vencimiento"
                    value={a.vencimiento ?? ""}
                    onChange={(e) => void editar("activos", a.id, { vencimiento: e.target.value || null })}
                  />
                </td>
                <td>
                  <button className="borrar" aria-label={`Eliminar ${a.nombre}`} onClick={() => void borrar("activos", a.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {activos.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td className="r tot">{$(total)}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <button
        className="agregar"
        onClick={() =>
          void crear("activos", {
            usuario_id: null,
            nombre: "",
            tipo: "ahorro",
            valor: 0,
            tasa_ea: null,
            aporte_mensual: 0,
            vencimiento: null,
            orden: activos.length + 1,
          })
        }
      >
        + Agregar
      </button>
    </section>
  );
}
