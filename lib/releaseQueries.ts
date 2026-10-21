import { useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";

/**
 * Controllo aggiornamenti dalla release GitHub del progetto: l'app parla
 * solo col proprio repo pubblico (`/releases/latest`, API senza token).
 *
 * - repo pubblico → nessuna autenticazione; rate limit 60 richieste/ora per
 *   IP, quindi `staleTime` di 6 ore, niente retry né refetch al focus:
 *   un controllo ogni 6 ore per sessione è il massimo che serve;
 * - un fallimento non è un errore utente: il banner semplicemente non
 *   compare (rete assente, rate limit, nessuna release).
 */

const RELEASES_API =
  "https://api.github.com/repos/mircoiolandaemattia-star/Evolvi/releases/latest";

export type LatestRelease = {
  /** Tag della release, es. "v1.2.0". */
  tag: string;
  /** Nome mostrato, es. "Evolvi 1.2.0" (con ripiego sul tag). */
  name: string;
  /** Pagina della release: è lì che si scarica l'APK/IPA. */
  url: string;
};

/** Versione dell'app in esecuzione (app.json), senza un eventuale "v". */
export function currentAppVersion(): string {
  return (Constants.expoConfig?.version ?? "0.0.0").replace(/^v/, "");
}

/**
 * Confronto semver approssimato a major/minor/patch numerici: ignora
 * suffissi come "-beta.1" (basta non farli sembrare più recenti).
 */
export function isNewerVersion(tag: string, current: string): boolean {
  const parse = (value: string) =>
    value
      .replace(/^v/, "")
      .split(/[.-]/)
      .slice(0, 3)
      .map((part) => {
        const number = parseInt(part, 10);
        return Number.isFinite(number) ? number : 0;
      });
  const [aMajor, aMinor, aPatch] = parse(tag);
  const [bMajor, bMinor, bPatch] = parse(current);
  if (aMajor !== bMajor) return aMajor > bMajor;
  if (aMinor !== bMinor) return aMinor > bMinor;
  return aPatch > bPatch;
}

async function fetchLatestRelease(): Promise<LatestRelease | null> {
  const response = await fetch(RELEASES_API, {
    headers: { Accept: "application/vnd.github+json" },
  });
  // 404 (repo senza release), rate limit, 5xx: niente banner, niente errore.
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    tag_name?: string;
    name?: string | null;
    html_url?: string;
  };
  if (!payload.tag_name || !payload.html_url) return null;
  return {
    tag: payload.tag_name,
    name: payload.name?.trim() || payload.tag_name,
    url: payload.html_url,
  };
}

/**
 * Ultima release pubblica **solo se più recente della versione in uso**:
 * `data` resta `null` (banner nascosto) per stessa versione, versione
 * inferiore o controllo fallito. La chiave include la versione, così un
 * upgrade dell'app ricontrolla da capo.
 */
export function useHasUpdate() {
  return useQuery({
    queryKey: ["github-latest-release", currentAppVersion()],
    queryFn: async () => {
      const release = await fetchLatestRelease();
      if (!release || !isNewerVersion(release.tag, currentAppVersion())) return null;
      return release;
    },
    staleTime: 6 * 60 * 60_000,
    refetchOnWindowFocus: false,
    retry: 0,
  });
}
