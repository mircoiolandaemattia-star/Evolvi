import { useState } from "react";
import { Text, View } from "react-native";
import Animated, {
  useAnimatedProps,
  useDerivedValue,
  withTiming,
  Easing,
  type SharedValue,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { CountUp } from "@/components/ui/CountUp";
import { useRevealProgress } from "@/lib/reveal";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type TrendPoint = { date: string; label: string; value: number };

/**
 * Formatta un valore del grafico: interi senza decimali, altrimenti il
 * decimale solo quando serve ("60 kg", "12.5 kg").
 */
export function formatTrendValue(value: number, decimals: number): string {
  if (decimals <= 0) return String(Math.round(value));
  const fixed = value.toFixed(decimals);
  return fixed.endsWith(".0") ? fixed.slice(0, -2) : fixed;
}

type Props = {
  /**
   * Serie in ordine cronologico (almeno un punto: lo stato vuoto è
   * `emptyText`, gestito prima di montare il corpo del grafico).
   */
  points: TrendPoint[];
  /** Unità in testa e nel delta (kg, rip.). */
  unit: string;
  /** Decimali in testa (0 = interi, come le ripetizioni). */
  decimals: number;
  /** Testo quando la serie della metrica selezionata è vuota. */
  emptyText: string;
};

/**
 * Line chart generico "si disegna" riusando l'entrata di `lib/reveal`: la
 * curva ricomincia a ogni visita della tab, come il resto di Progressi.
 * Stessa griglia/punti di `WeightChart`, ma guidata dai dati invece che dal
 * peso corporeo.
 */
export function TrendChart({ points, unit, decimals, emptyText }: Props) {
  const [containerW, setContainerW] = useState(0);
  const chartH = 150;
  const padL = 12;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const w = containerW > 0 ? containerW : 320;
  const h = chartH;

  if (points.length === 0) {
    return (
      <View className="items-center py-6">
        <Text className="font-sans text-sm text-muted">{emptyText}</Text>
      </View>
    );
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values) - 0.5;
  const max = Math.max(...values) + 0.5;
  const range = max - min || 1;

  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const x = (i: number) => padL + (i / Math.max(1, points.length - 1)) * plotW;
  const y = (v: number) => padT + (1 - (v - min) / range) * plotH;

  let d = "";
  points.forEach((point, i) => {
    const xi = x(i);
    const yi = y(point.value);
    d += i === 0 ? `M ${xi} ${yi}` : ` L ${xi} ${yi}`;
  });

  // Somma dei segmenti: serve allo strokeDashoffset che "disegna" la curva.
  let pathLength = 0;
  for (let i = 1; i < points.length; i++) {
    pathLength += Math.hypot(
      x(i) - x(i - 1),
      y(points[i].value) - y(points[i - 1].value),
    );
  }

  const current = values[values.length - 1] ?? 0;
  const first = values[0] ?? 0;
  const delta = Math.round((current - first) * 10) / 10;
  const deltaColor = delta > 0 ? "#22C55E" : delta < 0 ? "#EF4444" : "#94A3B8";
  const deltaLabel = `${delta > 0 ? "+" : ""}${formatTrendValue(delta, decimals)} ${unit}`;

  return (
    <TrendChartBody
      // Il cambio metrica (kg ↔ rip.) rimonta il corpo: la nuova curva si
      // ridisegna invece di apparire già finita.
      key={unit}
      points={points}
      d={d}
      pathLength={pathLength}
      x={x}
      y={y}
      padL={padL}
      padT={padT}
      plotW={plotW}
      plotH={plotH}
      w={w}
      h={h}
      unit={unit}
      decimals={decimals}
      current={current}
      deltaLabel={deltaLabel}
      deltaColor={deltaColor}
      onLayoutWidth={setContainerW}
    />
  );
}

type BodyProps = {
  points: TrendPoint[];
  d: string;
  pathLength: number;
  x: (i: number) => number;
  y: (v: number) => number;
  padL: number;
  padT: number;
  plotW: number;
  plotH: number;
  w: number;
  h: number;
  unit: string;
  decimals: number;
  current: number;
  deltaLabel: string;
  deltaColor: string;
  onLayoutWidth: (width: number) => void;
};

/** Corpo del grafico: separato perché gli hook Reanimated restano in un componente. */
function TrendChartBody({
  points,
  d,
  pathLength,
  x,
  y,
  padL,
  padT,
  plotW,
  plotH,
  w,
  h,
  unit,
  decimals,
  current,
  deltaLabel,
  deltaColor,
  onLayoutWidth,
}: BodyProps) {
  // 0→1 che riparte a ogni focus: la curva si ridisegna a ogni visita.
  const draw = useRevealProgress(260, 900);

  const animatedPathProps = useAnimatedProps(() => ({
    strokeDashoffset: pathLength * (1 - draw.value),
  }));

  const total = Math.max(1, points.length - 1);

  return (
    <View className="gap-3">
      <View className="flex-row items-baseline gap-2">
        <Text className="font-inter-bold text-3xl text-foreground">
          <CountUp value={current} format={(value) => formatTrendValue(value, decimals)} />{" "}
          {unit}
        </Text>
        <Text style={{ color: deltaColor }} className="font-inter-semibold text-sm">
          {deltaLabel}
        </Text>
        <Text className="font-sans text-xs text-muted">vs inizio periodo</Text>
      </View>

      <View
        className="w-full overflow-hidden"
        onLayout={(e) => onLayoutWidth(e.nativeEvent.layout.width)}
        style={{ height: h, width: "100%" }}
      >
        <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          {/* Griglia orizzontale */}
          {[0, 1, 2, 3].map((i) => {
            const gy = padT + (i / 3) * plotH;
            return (
              <Line
                key={i}
                x1={padL}
                y1={gy}
                x2={padL + plotW}
                y2={gy}
                stroke="#334155"
                strokeOpacity={0.4}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            );
          })}
          {/* Curva disegnata via strokeDashoffset */}
          <AnimatedPath
            d={d}
            stroke="#F97316"
            strokeWidth={2.5}
            fill="none"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={`${pathLength} ${pathLength}`}
            animatedProps={animatedPathProps}
          />
          {/* Punti: compaiono in scala appena la curva li raggiunge */}
          {points.map((point, i) => (
            <AnimatedPoint
              key={`${point.date}-${i}`}
              cx={x(i)}
              cy={y(point.value)}
              draw={draw}
              start={0.1 + (i / total) * 0.75}
            />
          ))}
          {/* Etichette X: sotto i 12 punti tutte, poi una ogni n */}
          {points.map((point, i) => {
            const step = points.length > 12 ? Math.ceil(points.length / 6) : 1;
            if (i % step !== 0 && i !== points.length - 1) return null;
            return (
              <SvgText
                key={`lbl-${point.date}-${i}`}
                x={x(i)}
                y={h - 6}
                fill="#94A3B8"
                fontSize={10}
                textAnchor="middle"
              >
                {point.label}
              </SvgText>
            );
          })}
        </Svg>
      </View>
    </View>
  );
}

/**
 * Punto del grafico: cresce in raggio appena la curva lo raggiunge.
 * `start` è la frazione di `draw` in cui comincia a comparire.
 */
function AnimatedPoint({
  cx,
  cy,
  draw,
  start,
}: {
  cx: number;
  cy: number;
  draw: SharedValue<number>;
  start: number;
}) {
  const progress = useDerivedValue(() => {
    if (draw.value <= start) return 0;
    return withTiming(Math.min(1, (draw.value - start) / 0.15), {
      duration: 120,
      easing: Easing.out(Easing.quad),
    });
  });

  const animatedProps = useAnimatedProps(() => ({
    r: 3.5 * progress.value,
    opacity: progress.value,
  }));

  return (
    <AnimatedCircle
      cx={cx}
      cy={cy}
      fill="#F97316"
      stroke="#0F172A"
      strokeWidth={1.5}
      animatedProps={animatedProps}
    />
  );
}
