import { Image } from "react-native";

type LogoProps = {
  /** Lato del logo in punti. Default 80. */
  size?: number;
  /** Classi NativeWind aggiunte al contenitore (es. margini). */
  className?: string;
};

/**
 * Logo ufficiale di Evolvi (icona PNG quadrata con sfondo navy).
 *
 * Lo sorgente è `icon.png` alla radice: `scripts/generate-app-icons.sh`
 * genera da lì tutte le risoluzioni, incluse `assets/images/logo.png`
 * (usata qui) e `assets/images/logo-mark.png` (solo marchio, sfondo
 * trasparente) per contesti con sfondo proprio.
 */
export function Logo({ size = 80, className }: LogoProps) {
  return (
    <Image
      source={require("../assets/images/logo.png")}
      accessibilityLabel="Evolvi"
      resizeMode="contain"
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        borderWidth: 1,
        borderColor: "rgba(248, 250, 252, 0.08)",
      }}
    />
  );
}
