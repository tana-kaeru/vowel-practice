import type { FormantEstimate, VowelSymbol, VowelTrace } from "@/types/vowel";
import { VOWEL_TARGETS } from "@/lib/data/vowelTargets";

type VowelMapProps = {
  selectedVowel: VowelSymbol;
  formants: FormantEstimate | null;
  trail: FormantEstimate[];
  currentTrace: VowelTrace | null;
  completedTraces: VowelTrace[];
  showTraceHistory: boolean;
  onClearTraceHistory: () => void;
  onToggleTraceHistory: (show: boolean) => void;
};

const MAP_F1_RANGE = { min: 200, max: 1000 };
const MAP_F2_RANGE = { min: 700, max: 3000 };
const VIEWBOX = { width: 360, height: 260 };

function getPosition(f1Hz: number, f2Hz: number) {
  const x =
    ((f2Hz - MAP_F2_RANGE.min) / (MAP_F2_RANGE.max - MAP_F2_RANGE.min)) *
    VIEWBOX.width;
  const y =
    ((f1Hz - MAP_F1_RANGE.min) / (MAP_F1_RANGE.max - MAP_F1_RANGE.min)) *
    VIEWBOX.height;

  return {
    x: Math.max(8, Math.min(VIEWBOX.width - 8, x)),
    y: Math.max(8, Math.min(VIEWBOX.height - 8, y)),
  };
}

function getAreaRect(target: (typeof VOWEL_TARGETS)[number]) {
  const topLeft = getPosition(target.f1Range.min, target.f2Range.min);
  const bottomRight = getPosition(target.f1Range.max, target.f2Range.max);

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

function getTracePoints(trace: VowelTrace) {
  return trace.points.map((point) => getPosition(point.f1Hz, point.f2Hz));
}

function getPolylinePoints(points: { x: number; y: number }[]) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

const HISTORY_OPACITY = [0.55, 0.35, 0.22, 0.14, 0.08];

export default function VowelMap({
  selectedVowel,
  formants,
  trail,
  currentTrace,
  completedTraces,
  showTraceHistory,
  onClearTraceHistory,
  onToggleTraceHistory,
}: VowelMapProps) {
  const currentPosition = formants
    ? getPosition(formants.f1Hz, formants.f2Hz)
    : null;
  const trailPoints = trail.map((item) => getPosition(item.f1Hz, item.f2Hz));
  const polylinePoints = getPolylinePoints(trailPoints);
  const visibleCompletedTraces = showTraceHistory ? completedTraces : [];
  const currentTracePoints = currentTrace ? getTracePoints(currentTrace) : [];
  const currentTracePolyline = getPolylinePoints(currentTracePoints);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-zinc-950">母音マップ</h2>
          <p className="mt-1 text-sm text-zinc-600">F1/F2の推定位置</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => onToggleTraceHistory(!showTraceHistory)}
            className="h-8 rounded-lg border border-zinc-200 px-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            履歴{showTraceHistory ? "表示" : "非表示"}
          </button>
          <button
            type="button"
            onClick={onClearTraceHistory}
            className="h-8 rounded-lg border border-zinc-200 px-2 text-xs font-medium text-zinc-700 transition hover:bg-zinc-50"
          >
            履歴をクリア
          </button>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
        <svg
          viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
          className="h-72 w-full touch-none sm:h-80"
          role="img"
          aria-label="F1とF2による母音マップ"
        >
          <rect width={VIEWBOX.width} height={VIEWBOX.height} fill="#fafafa" />
          {[0, 1, 2, 3, 4].map((index) => {
            const y = (VIEWBOX.height / 4) * index;

            return (
              <line
                key={`h-${index}`}
                x1="0"
                x2={VIEWBOX.width}
                y1={y}
                y2={y}
                stroke="#e4e4e7"
                strokeWidth="1"
              />
            );
          })}
          {[0, 1, 2, 3, 4].map((index) => {
            const x = (VIEWBOX.width / 4) * index;

            return (
              <line
                key={`v-${index}`}
                x1={x}
                x2={x}
                y1="0"
                y2={VIEWBOX.height}
                stroke="#e4e4e7"
                strokeWidth="1"
              />
            );
          })}
          {VOWEL_TARGETS.map((target) => {
            const rect = getAreaRect(target);
            const isSelected = target.vowel === selectedVowel;
            const labelPosition = getPosition(
              (target.f1Range.min + target.f1Range.max) / 2,
              (target.f2Range.min + target.f2Range.max) / 2,
            );

            return (
              <g key={target.vowel}>
                <rect
                  x={rect.x}
                  y={rect.y}
                  width={rect.width}
                  height={rect.height}
                  rx="8"
                  fill={target.color}
                  opacity={isSelected ? "0.24" : "0.12"}
                  stroke={target.color}
                  strokeWidth={isSelected ? "3" : "1.5"}
                />
                <circle
                  cx={(target.mapPosition.x / 100) * VIEWBOX.width}
                  cy={(target.mapPosition.y / 100) * VIEWBOX.height}
                  r={isSelected ? "15" : "12"}
                  fill={target.color}
                  opacity={isSelected ? "1" : "0.75"}
                />
                <text
                  x={labelPosition.x}
                  y={labelPosition.y + 4}
                  textAnchor="middle"
                  className="fill-zinc-950 text-[13px] font-semibold"
                >
                  {target.label}
                </text>
              </g>
            );
          })}
          {visibleCompletedTraces.map((trace, traceIndex) => {
            const points = getTracePoints(trace);
            const opacity =
              HISTORY_OPACITY[
                Math.max(0, visibleCompletedTraces.length - 1 - traceIndex)
              ] ?? 0.08;
            const linePoints = getPolylinePoints(points);
            const lastPoint = points.at(-1);

            return (
              <g key={trace.id} opacity={opacity}>
                {linePoints ? (
                  <polyline
                    points={linePoints}
                    fill="none"
                    stroke="#0f766e"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {lastPoint ? (
                  <circle cx={lastPoint.x} cy={lastPoint.y} r="4" fill="#0f766e" />
                ) : null}
              </g>
            );
          })}
          {currentTracePolyline ? (
            <polyline
              points={currentTracePolyline}
              fill="none"
              stroke="#18181b"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.9"
            />
          ) : null}
          {currentTracePoints.map((point, index) => (
            <circle
              key={`current-${point.x}-${point.y}-${index}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#18181b"
              opacity={0.22 + (index / Math.max(1, currentTracePoints.length - 1)) * 0.5}
            />
          ))}
          {polylinePoints ? (
            <polyline
              points={polylinePoints}
              fill="none"
              stroke="#18181b"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0.22"
            />
          ) : null}
          {trailPoints.map((point, index) => (
            <circle
              key={`${point.x}-${point.y}-${index}`}
              cx={point.x}
              cy={point.y}
              r="3"
              fill="#18181b"
              opacity={0.08 + (index / Math.max(1, trailPoints.length - 1)) * 0.24}
            />
          ))}
          {currentPosition ? (
            <circle
              cx={currentPosition.x}
              cy={currentPosition.y}
              r="7"
              fill="#18181b"
              stroke="#ffffff"
              strokeWidth="3"
            />
          ) : null}
          <text x="10" y="18" className="fill-zinc-500 text-[11px]">
            F1低
          </text>
          <text x="10" y={VIEWBOX.height - 10} className="fill-zinc-500 text-[11px]">
            F1高
          </text>
          <text
            x={VIEWBOX.width - 10}
            y={VIEWBOX.height - 10}
            textAnchor="end"
            className="fill-zinc-500 text-[11px]"
          >
            F2高
          </text>
        </svg>
      </div>
    </section>
  );
}
