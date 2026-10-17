import { cssInterop } from "nativewind";
import Animated from "react-native-reanimated";

/**
 * Registra i componenti di Reanimated con NativeWind.
 *
 * NativeWind inoltra la prop `className` al DOM solo per i componenti che
 * conosce (View, Text, ScrollView… li registra da solo). I componenti di
 * Reanimated (`Animated.View`, `Animated.Text`…) **non** sono registrati: la
 * `className` passa dritta a Reanimated, che sul web la ignora e la butta.
 * Risultato: su web tutte le utility (gap-4, flex-1, items-center, p-4…)
 * applicate a `Animated.View` diventavano no-op, mentre su iOS funzionavano.
 * Da qui gli sfasamenti (login senza gap, card scheda impilate, statistiche
 * non estese, impostazioni senza spaziatura).
 *
 * `cssInterop` registra il componente nella mappa usata dal jsx-runtime di
 * NativeWind: da ora ogni `<Animated.View className="…">` viene wrappato e la
 * className arriva al DOM anche su web, con lo stesso trattamento di `View`.
 *
 * Va eseguito una sola volta prima del primo render: importarlo da `_layout`
 * garantisce che capiti prima di qualunque schermata.
 */
cssInterop(Animated.View, { className: "style" });
cssInterop(Animated.Text, { className: "style" });
cssInterop(Animated.ScrollView, { className: "style" });
cssInterop(Animated.Image, { className: "style" });
cssInterop(Animated.FlatList, { className: "style" });
