#!/usr/bin/env bash
#
# Genera tutti gli asset icona dell'app a partire da un singolo sorgente.
#
#   Uso:  bash scripts/generate-app-icons.sh [percorso/icona-1024.png]
#
# Sorgente di default: ./icon.png (1024x1024, sfondo navy #061326).
# Da quel file ricava:
#   - assets/images/icon.png                  (icona app 1024, iOS + base)
#   - assets/images/logo.png                  (quadrato 512, per l'UI in-app)
#   - assets/images/logo-mark.png             (solo marchio, sfondo trasparente)
#   - assets/images/favicon.png               (48x48)
#   - assets/images/splash-icon.png           (splash, sfondo trasparente)
#   - assets/images/android-icon-foreground.png / -background.png / -monochrome.png
#   - public/icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png,
#     favicon.png
set -euo pipefail

cd "$(dirname "$0")/.."

SRC="${1:-./icon.png}"
BG="#0F172A"          # colore di sfondo del design system
SRC_BG="#061326"      # sfondo reale del sorgente (per il keying del marchio)

command -v magick >/dev/null || { echo "ImageMagick (magick) non trovato"; exit 1; }
[ -f "$SRC" ] || { echo "Sorgente $SRC non trovata"; exit 1; }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# --- 1. marchio isolato (sfondo navy reso trasparente, bordi ritagliati) -----
magick "$SRC" -fuzz 12% -transparent "$SRC_BG" -trim +repage "$TMP/mark.png"
read -r MW MH < <(magick identify -format "%w %h\n" "$TMP/mark.png")

# Ogni "-resize LxL" preserva l'aspect ratio e inscrive il marchio nel
# quadrato di lato L, centrato nel canvas (gravity center).

echo "Sorgente: $SRC ($SRC_BG) — marchio ${MW}x${MH}"

# --- 2. icone "piene" (sfondo incluso) --------------------------------------
magick "$SRC" -resize 1024x1024 -depth 8 -strip assets/images/icon.png
magick "$SRC" -resize 512x512  -depth 8 -strip assets/images/logo.png
magick "$SRC" -resize 512x512  -depth 8 -strip public/icon-512.png
magick "$SRC" -resize 192x192  -depth 8 -strip public/icon-192.png
magick "$SRC" -resize 180x180  -depth 8 -strip public/apple-touch-icon.png

# favicon: quadrato navy con il marchio al 70%
magick -size 48x48 "xc:$BG" \
  \( "$TMP/mark.png" -resize 34x34 \) -gravity center -composite \
  -depth 8 -strip assets/images/favicon.png
cp assets/images/favicon.png public/favicon.png

# maskable PWA: sfondo full-bleed + marchio dentro il cerchio sicuro (80%)
magick -size 512x512 "xc:$BG" \
  \( "$TMP/mark.png" -resize 288x288 \) -gravity center -composite \
  -depth 8 -strip public/icon-512-maskable.png

# --- 3. marchio trasparente per UI/splash ------------------------------------
magick "$TMP/mark.png" -resize 512x512 -depth 8 -strip assets/images/logo-mark.png
magick -size 512x512 "xc:none" \
  \( "$TMP/mark.png" -resize 300x300 \) -gravity center -composite \
  -depth 8 -strip assets/images/splash-icon.png

# --- 4. adaptive icon Android ------------------------------------------------
# foreground: marchio nel 58% del canvas (safe zone 66/108dp), sfondo trasparente
magick -size 512x512 "xc:none" \
  \( "$TMP/mark.png" -resize 296x296 \) -gravity center -composite \
  -depth 8 -strip assets/images/android-icon-foreground.png

magick -size 512x512 "xc:$BG" -depth 8 -strip assets/images/android-icon-background.png

# monochrome (themed icons Android 13+): silhouette bianca che mantiene l'alpha
magick assets/images/android-icon-foreground.png -fill white -colorize 100 \
  -depth 8 -strip assets/images/android-icon-monochrome.png

echo "Fatto. Asset generati in assets/images e public."
