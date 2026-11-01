import { normalizar } from "@/lib/habitos";

/**
 * Etiquetas de gasto: el oráculo agrupa las compras por lo que SON, no por
 * cómo se escribieron. "Almuerzo corrientazo", "Hamburguesa" y "Domicilio
 * Rappi" son la misma costumbre —comer por fuera— aunque el concepto y el
 * monto cambien cada vez. Sin esto, los hábitos se fragmentan en veinte
 * grupos de una compra y el total real queda invisible.
 *
 * Cada etiqueta tiene raíces: una palabra del concepto que empiece por una
 * raíz (o sea exactamente ella, si es corta) le pone la etiqueta. La primera
 * etiqueta que encaje gana, así que van de la más específica a la más
 * general. Todo es local: nada sale de la aplicación.
 */

const ETIQUETAS: Array<[string, string[]]> = [
  [
    "Comidas por fuera",
    [
      "almuerz", "comida", "cena", "desayun", "corrientazo", "corrient",
      "restaurant", "hamburgues", "pizza", "salchipapa", "arepa", "empanad",
      "pollo", "asado", "sushi", "china", "chino", "domicilio", "rappi",
      "ifood", "mcdonald", "kfc", "frisby", "domino", "subway", "burger",
      "taco", "sandwich", "sanduche", "shawarma", "bandeja", "parrilla",
      "wok", "ceviche", "corral", "qbano", "perro",
    ],
  ],
  [
    "Café y antojos",
    [
      "cafe", "tinto", "capuchino", "cappuccino", "panaderia", "pan",
      "pastel", "postre", "helado", "dulce", "mecato", "snack", "galleta",
      "brownie", "torta", "croissant", "jugo", "batido", "granizado",
      // "dona" a secas no: "doña" sin tilde queda igual y atraparía
      // "Tienda doña Marta".
      "chocolate", "oblea", "churro", "donas", "waffle", "crepe", "yogur",
      "gomita", "fruta", "fruver",
    ],
  ],
  [
    "Licor y salidas",
    [
      "cerveza", "pola", "licor", "aguardiente", "guaro", "ron", "whisky",
      "tequila", "vino", "bar", "discoteca", "rumba", "cine", "boleta",
      "cover", "coctel", "michelada", "trago",
    ],
  ],
  [
    "Transporte suelto",
    [
      "taxi", "uber", "didi", "cabify", "indriver", "bus", "buseta", "metro",
      "transmilenio", "pasaje", "parqueadero", "peaje", "gasolina", "mototaxi",
    ],
  ],
  [
    "Tienda y mercaditos",
    ["tienda", "minimercado", "minimarket", "d1", "ara", "oxxo", "drogueria"],
  ],
  [
    "Juegos y apps",
    ["steam", "xbox", "nintendo", "juego", "skin", "robux", "vbucks", "recarga", "app"],
  ],
];

function encaja(palabra: string, raiz: string): boolean {
  // Raíces cortas piden palabra exacta: "pan" no debe atrapar "pantalones".
  return raiz.length >= 4 ? palabra === raiz || palabra.startsWith(raiz) : palabra === raiz;
}

/** La etiqueta del concepto, o null si ninguna encaja. */
export function etiquetaDe(concepto: string): string | null {
  const palabras = normalizar(concepto).split(" ");
  for (const [nombre, raices] of ETIQUETAS) {
    if (palabras.some((p) => raices.some((r) => encaja(p, r)))) return nombre;
  }
  return null;
}

/** Los nombres de las etiquetas, por si una pantalla quiere listarlas. */
export const NOMBRES_ETIQUETAS = ETIQUETAS.map(([nombre]) => nombre);
