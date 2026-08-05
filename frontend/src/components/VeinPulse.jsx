/**
 * Decorative vessel network with travelling pulses.
 *
 * The landing page's idea — blood converging through branching vessels —
 * rendered as static SVG plus CSS instead of WebGL: no Three.js, no render
 * loop, a few hundred bytes. Each vessel carries `pathLength="100"`, so one
 * dash animation drives every path identically no matter its real length.
 */
export default function VeinPulse({ className = '' }) {
  // Two trunks entering from each side, branching as they run inward.
  const vessels = [
    { d: 'M-10 96 C 90 88, 150 132, 236 128 S 372 104, 430 118', delay: '0s', dur: '5.2s' },
    { d: 'M-10 168 C 74 176, 122 150, 196 156 S 320 190, 430 176', delay: '1.4s', dur: '6.1s' },
    { d: 'M-10 238 C 96 244, 140 210, 224 214 S 348 246, 430 232', delay: '2.6s', dur: '5.6s' },
    { d: 'M196 156 C 212 118, 226 96, 248 62 S 268 24, 276 -8', delay: '3.4s', dur: '6.6s' },
    { d: 'M224 214 C 238 258, 252 286, 268 322 S 286 372, 292 408', delay: '0.8s', dur: '5.9s' },
    { d: 'M236 128 C 268 150, 300 158, 342 154', delay: '4.1s', dur: '4.8s' },
  ];

  return (
    <svg
      className={`vein-pulse ${className}`}
      viewBox="0 0 420 400"
      fill="none"
      aria-hidden="true"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="vein-bed" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#4a0000" stopOpacity="0.15" />
          <stop offset="50%" stopColor="#8b0000" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#4a0000" stopOpacity="0.15" />
        </linearGradient>
      </defs>

      {/* Resting vessel walls. */}
      {vessels.map((v) => (
        <path
          key={`bed-${v.d}`}
          d={v.d}
          stroke="url(#vein-bed)"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      ))}

      {/* Cells travelling toward the centre. */}
      <g className="vein-pulse__flow">
        {vessels.map((v) => (
          <path
            key={`flow-${v.d}`}
            d={v.d}
            pathLength="100"
            stroke="#c1121f"
            strokeWidth="2.1"
            strokeLinecap="round"
            style={{ animationDelay: v.delay, animationDuration: v.dur }}
          />
        ))}
      </g>

      {/* The convergence point the vessels are feeding. */}
      <circle className="vein-pulse__core" cx="228" cy="166" r="3.4" fill="#ff6b6b" />
    </svg>
  );
}
