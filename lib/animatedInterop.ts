import { Platform } from "react-native";
import { cssInterop } from "nativewind";
import Animated from "react-native-reanimated";

/**
 * Registra i componenti di Reanimated con NativeWind **sul web**.
 *
 * NativeWind inoltra la prop `className` al DOM solo per i componenti che
 * conosce (View, Text, ScrollView… li registra da solo). I componenti di
 * Reanimated (`Animated.View`, `Animated.Text`…) non sono registrati: sul web
 * la `className` passa dritta a Reanimated, che la ignora e la butta. Da qui
 * gli sfasamenti web (login senza gap, card scheda impilate, statistiche non
 * estese, impostazioni senza spaziatura): le utility diventavano no-op.
 *
 * Sul native invece il problema **non esisteva**: la className veniva già
 * gestita dal percorso nativo di NativeWind. Registrare `cssInterop` qui
 * interferiva con lo stile animato di Reanimated e **rompeva** le schermate
 * native, quindi la registrazione va fatta solo su web.
 *
 * Va eseguito una sola volta prima del primo render: importarlo da `_layout`
 * garantisce che capiti prima di qualunque schermata.
 */
if (Platform.OS === "web") {
  cssInterop(Animated.View, { className: "style" });
  cssInterop(Animated.Text, { className: "style" });
  cssInterop(Animated.ScrollView, { className: "style" });
  cssInterop(Animated.Image, { className: "style" });
  cssInterop(Animated.FlatList, { className: "style" });
}
