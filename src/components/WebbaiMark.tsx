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
        "inline-grid place-items-center rounded-full bg-sidebar-accent text-primary shrink-0 overflow-hidden",
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
        <g className={animated ? "webbai-orbit webbai-orbit-a" : undefined} style={{ transformOrigin: "50% 50%" }}>
          <ellipse cx="50" cy="50" rx="46" ry="19" />
        </g>
        <g
          className={animated ? "webbai-orbit webbai-orbit-b" : undefined}
          style={{ transformOrigin: "50% 50%" }}
          transform="rotate(60 50 50)"
        >
          <ellipse cx="50" cy="50" rx="46" ry="19" />
        </g>
        <g
          className={animated ? "webbai-orbit webbai-orbit-c" : undefined}
          style={{ transformOrigin: "50% 50%" }}
          transform="rotate(120 50 50)"
        >
          <ellipse cx="50" cy="50" rx="46" ry="19" />
        </g>
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
