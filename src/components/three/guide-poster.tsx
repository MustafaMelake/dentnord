import { cn } from "@/lib/utils";

/**
 * Static poster of the guide: shown while the 3D viewer loads, without WebGL, and under reduced
 * motion. A line drawing of an arch with sleeves on a soft glow, meant for the brand-deep card.
 */
export function GuidePoster({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("flex items-center justify-center", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(55%_50%_at_50%_55%,rgb(143_180_221/0.35),transparent_70%)]" />
      <svg viewBox="0 0 400 320" className="relative w-[72%] max-w-[26rem]" fill="none">
        <defs>
          <linearGradient id="guide-poster-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#eef5fc" stopOpacity="0.55" />
            <stop offset="1" stopColor="#8fb4dd" stopOpacity="0.2" />
          </linearGradient>
        </defs>
        {/* Arch (outer and inner outlines), seen at an angle */}
        <path
          d="M52 210 C52 110 120 52 200 52 C280 52 348 110 348 210 C348 236 330 250 312 238 C300 230 300 214 300 200 C300 140 256 102 200 102 C144 102 100 140 100 200 C100 214 100 230 88 238 C70 250 52 236 52 210 Z"
          fill="url(#guide-poster-fill)"
          stroke="#d6e6f5"
          strokeOpacity="0.7"
          strokeWidth="1.5"
        />
        {/* Sleeves */}
        {[
          [78, 190],
          [118, 104],
          [222, 77],
          [318, 176],
        ].map(([cx, cy]) => (
          <g key={`${cx}-${cy}`}>
            <ellipse cx={cx} cy={cy} rx="12" ry="7" fill="#d3d9e0" fillOpacity="0.85" />
            <ellipse cx={cx} cy={cy} rx="6.5" ry="3.8" fill="#0f2e4c" />
          </g>
        ))}
        {/* Contact shadow */}
        <ellipse cx="200" cy="284" rx="150" ry="14" fill="#061423" fillOpacity="0.35" />
      </svg>
    </div>
  );
}
