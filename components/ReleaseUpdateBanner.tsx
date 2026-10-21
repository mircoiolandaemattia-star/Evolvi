import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as WebBrowser from "expo-web-browser";
import { Rocket, X } from "lucide-react-native";
import { Card } from "@/components/home/Card";
import { useHasUpdate } from "@/lib/releaseQueries";

// Chiusura persistente per TAG: un nuovo rilascio (tag diverso) fa
// ricomparire il banner, quelli già ignorati restano zitti.
const DISMISS_KEY = "evolvi_release_banner_dismissed";

/**
 * Banner "aggiornamento disponibile": compare quando l'ultima release del
 * repo è più recente della versione installata e porta alla pagina della
 * release (da lì si scarica l'APK o l'IPA).
 */
export function ReleaseUpdateBanner() {
  const { data: release } = useHasUpdate();
  // Flag di chiusura letto prima del render: senza questo gate il banner
  // potrebbe lampeggiare un attimo per chi ha già chiuso la notifica.
  const [dismissLoaded, setDismissLoaded] = useState(false);
  const [dismissedTag, setDismissedTag] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(DISMISS_KEY)
      .then((value) => {
        if (!mounted) return;
        setDismissedTag(value);
        setDismissLoaded(true);
      })
      .catch(() => {
        if (!mounted) return;
        setDismissLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (!dismissLoaded || !release || release.tag === dismissedTag) return null;

  function handleDismiss(tag: string) {
    setDismissedTag(tag);
    void AsyncStorage.setItem(DISMISS_KEY, tag).catch(() => {});
  }

  function handleOpen(url: string) {
    void WebBrowser.openBrowserAsync(url).catch(() => {});
  }

  return (
    <Card className="gap-4 border-primary/20 bg-primary/10">
      <View className="flex-row items-start justify-between gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-primary">
          <Rocket size={20} color="#0F172A" strokeWidth={2.2} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-inter-bold text-base text-foreground">
            Aggiornamento disponibile
          </Text>
          <Text className="font-sans text-sm leading-5 text-muted">
            È uscita {release.name}: aprila per scaricare la nuova versione.
          </Text>
        </View>
        <Pressable
          onPress={() => handleDismiss(release.tag)}
          hitSlop={8}
          className="h-8 w-8 items-center justify-center rounded-full bg-surface active:opacity-60"
          accessibilityLabel="Non mostrare più questo avviso"
        >
          <X size={14} color="#94A3B8" strokeWidth={2.5} />
        </Pressable>
      </View>

      <Pressable
        onPress={() => handleOpen(release.url)}
        accessibilityRole="link"
        className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:opacity-80"
      >
        <Rocket size={16} color="#0F172A" strokeWidth={2.2} />
        <Text className="font-inter-bold text-sm text-primary-foreground">Apri la release</Text>
      </Pressable>
    </Card>
  );
}
