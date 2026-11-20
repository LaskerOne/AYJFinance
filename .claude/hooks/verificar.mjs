// Hook Stop de Claude Code: antes de dar un turno por terminado, corre el
// lint y las pruebas. Si algo falla, sale con código 2 y Claude recibe el
// error para arreglarlo en vez de entregar un cambio roto.
//
// Escrito en Node y no en bash: en Windows no hay jq, y Node ya está
// instalado porque el proyecto lo necesita.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Solo lo que puede romper el lint o las pruebas. Cambiar el README o una
// migración no debería costar medio minuto de verificación.
const RUTAS = ["src", "package.json", "package-lock.json", "eslint.config.js", "tsconfig.json", "vite.config.ts"];
const PASOS = [
  ["Lint", "npm run lint"],
  ["Pruebas", "npm test"],
];
// Lo último de la salida es lo que dice qué falló; el resto es ruido.
const LINEAS_DE_ERROR = 40;

function leerEntrada() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

const entrada = leerEntrada();

// Si este turno ya es la respuesta a un bloqueo del hook, no se vuelve a
// bloquear: sin esto, un error que Claude no logra arreglar lo deja en un
// ciclo infinito.
if (entrada.stop_hook_active) process.exit(0);

const cambios = spawnSync("git", ["status", "--porcelain", "--", ...RUTAS], { encoding: "utf8" });
if (cambios.status !== 0 || !cambios.stdout.trim()) process.exit(0);

for (const [nombre, comando] of PASOS) {
  // Sin colores: los códigos ANSI no le dicen nada a quien lee el error.
  const r = spawnSync(comando, {
    shell: true,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
  if (r.status !== 0) {
    const salida = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split(/\r?\n/).slice(-LINEAS_DE_ERROR).join("\n");
    process.stderr.write(
      `${nombre} falló (\`${comando}\`). Corrígelo antes de terminar el turno.\n\n${salida}\n`,
    );
    process.exit(2);
  }
}

process.exit(0);
