import { cn } from "@/lib/utils";

type Props = {
  /** pixel size of the round mark */
  size?: number;
  /** spin the orbits + pulse the nucleus (used next to the thinking state) */
  animated?: boolean;
  className?: string;
};

/**
 * webbai brand mark: an electron-orbit atom inside a dark circle.
 * When `animated`, the three orbits counter-rotate and the nucleus pulses.
 */
export function WebbaiMark({ size = 32, animated = false, className }: Props) {
  return (
    <span
      className={cn(
        "relative inline-grid place-items-center rounded-full bg-sidebar-accent text-primary shrink-0",
        !animated && "shadow-md shadow-primary/20",
        animated && "webbai-mark-glow",
        className,
      )}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        width={size * 0.72}
        height={size * 0.72}
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
      >
        {[
          { rot: 0, cls: "webbai-orbit-a" },
          { rot: 60, cls: "webbai-orbit-b" },
          { rot: 120, cls: "webbai-orbit-c" },
        ].map(({ rot, cls }) => (
          // Outer <g> holds the fixed tilt; the inner <g> owns the CSS animation
          // so the spin never overwrites the tilt transform.
          <g key={rot} transform={`rotate(${rot} 50 50)`}>
            <g
              className={animated ? cn("webbai-orbit", cls) : undefined}
              style={{ transformOrigin: "50% 50%" }}
            >
              <ellipse cx="50" cy="50" rx="46" ry="19" />
            </g>
          </g>
        ))}
        <circle
          cx="50"
          cy="50"
          r="10"
          fill="currentColor"
          stroke="none"
          className={animated ? "webbai-nucleus" : undefined}
          style={{ transformOrigin: "50% 50%" }}
        />

      </svg>
    </span>
  );
}
