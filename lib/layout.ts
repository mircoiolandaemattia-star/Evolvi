import { useWindowDimensions } from "react-native";

/**
 * Larghezza minima (px) per passare al layout "wide": sotto è la colonna
 * compatta del telefono, sopra le schermate tab passano a due colonne e i
 * contenitori si centrano con una larghezza massima (desktop, tablet
 * orizzontale e finestre del browser).
 */
export const WIDE_BREAKPOINT = 768;

/**
 * Altezza della tab bar custom (variante "materiale" di app/(tabs)/_layout),
 * al netto degli inset gestiti. Serve per calcolare il padding sotto
 * l'ultimo elemento degli scroll che devono passare sopra la barra
 * (es. la sessione di allenamento attivo).
 */
export const TAB_BAR_HEIGHT = 54;

/**
 * Classi per il contenuto di una schermata "a piena pagina" (es. la
 * sessione di allenamento attivo): colonna centrata con larghezza massima
 * su desktop. Sul telefono non ha effetto (max-w-3xl è più largo dello
 * schermo) quindi si può applicare sempre, senza breakpoint.
 */
export const CENTERED_CONTENT = "mx-auto w-full max-w-3xl";

/**
 * true quando la finestra è abbastanza larga per il layout wide.
 *
 * Hook condiviso: prima il breakpoint era duplicato in ogni schermata e
 * modale (con anche valori inline), rischiando derives diverse fra loro.
 */
export function useIsWide(): boolean {
  const { width } = useWindowDimensions();
  return width >= WIDE_BREAKPOINT;
}
