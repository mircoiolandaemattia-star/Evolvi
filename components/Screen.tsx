import { type PropsWithChildren } from "react";
import { type ViewProps } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RevealProvider } from "@/lib/reveal";

type ScreenProps = PropsWithChildren<{
  /** Classi NativeWind applicate al contenitore. */
  className?: string;
  testID?: ViewProps["testID"];
}>;

/**
 * Schermata base: sfondo del tema e rispetto delle safe area
 * (top/laterali; il fondo è gestito da tab bar e pulsanti).
 *
 * Avvolge il contenuto in `RevealProvider`: è il modo centrale per far
 * ripetere le animazioni d'entrata a ogni cambio di tab (le `entering`
 * di Reanimated girano solo al mount, e le tab restano montate).
 */
export function Screen({ children, className, testID }: ScreenProps) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      testID={testID}
      className={`flex-1 bg-background ${className ?? ""}`}
    >
      <RevealProvider>{children}</RevealProvider>
    </SafeAreaView>
  );
}