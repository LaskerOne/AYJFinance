// Configuración plana de ESLint 9.
//
// La base es la recomendada de typescript-eslint, sin las variantes
// "strict" ni con información de tipos: el typecheck ya lo hace tsc, y
// aquí se buscan errores de lógica que tsc deja pasar (dependencias de
// hooks mal declaradas, código muerto, comparaciones sospechosas).
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  {
    files: ["**/*.{ts,tsx}"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // Un parámetro que se ignora a propósito se nombra con `_`.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
);
