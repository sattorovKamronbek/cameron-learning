import { useMemo } from 'react';
import type { RatingHistoryEntry } from '@/data/ratings';
import { getRatingColorData } from '@/data/ratings';

export function RatingGraph({
  history,
  width = 520,
  height = 140,
  accent = '#6366f1',
  showAxis = true,
}: {
  history: RatingHistoryEntry[];
  width?: number;
  height?: number;
  accent?: string;
  showAxis?: boolean;
}) {
  const data = useMemo(() => {
    if (history.length === 0) return null;
    const padX = 10;
    const padY = 14;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;
    const ratings = history.map((h) => h.newRating);
    const minR = Math.min(...ratings) - 50;
    const maxR = Math.max(...ratings) + 50;
    const range = maxR - minR || 1;

    const pts = history.map((h, i) => {
      const x = padX + (history.length === 1 ? chartW / 2 : (i / (history.length - 1)) * chartW);
      const y = padY + chartH - ((h.newRating - minR) / range) * chartH;
      return { x, y, rating: h.newRating };
    });

    const linePath = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${padY + chartH} L ${pts[0].x} ${padY + chartH} Z`;

    return { pts, linePath, areaPath, minR, maxR, padX, padY, chartW, chartH };
  }, [history, width, height]);

  if (!data) {
    return (
      <div className="flex items-center justify-center text-xs text-slate-400" style={{ height }}>
        No rating history yet
      </div>
    );
  }

  const gradId = `grad-${accent.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.25" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>

      {showAxis && [0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={data.padX}
          y1={data.padY + data.chartH * f}
          x2={data.padX + data.chartW}
          y2={data.padY + data.chartH * f}
          stroke="currentColor"
          strokeWidth="0.5"
          className="text-slate-200"
          strokeDasharray="3 3"
        />
      ))}

      <path d={data.areaPath} fill={`url(#${gradId})`} />
      <path d={data.linePath} fill="none" stroke={accent} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {data.pts.map((p, i) => {
        const colorData = getRatingColorData(p.rating);
        const isLast = i === data.pts.length - 1;
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={isLast ? 5 : 3} fill={colorData.hex} stroke="white" strokeWidth="1.5" />
            {isLast && (
              <circle cx={p.x} cy={p.y} r="9" fill="none" stroke={colorData.hex} strokeWidth="1.5" opacity="0.3" className="animate-pulse" />
            )}
          </g>
        );
      })}

      {showAxis && (
        <>
          <text x={data.padX} y={data.padY - 2} fontSize="9" fill="currentColor" className="text-slate-400 font-semibold">
            {data.maxR.toFixed(0)}
          </text>
          <text x={data.padX} y={data.padY + data.chartH + 10} fontSize="9" fill="currentColor" className="text-slate-400 font-semibold">
            {data.minR.toFixed(0)}
          </text>
        </>
      )}
    </svg>
  );
}
