"use client";

interface TurnoutRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function TurnoutRing({
  percentage,
  size = 160,
  strokeWidth = 12,
  className,
}: TurnoutRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentage / 100);

  return (
    <svg
      width={size}
      height={size}
      className={className}
      viewBox={`0 0 ${size} ${size}`}
      role="img"
      aria-label={`Partisipasi ${percentage}%`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--tenant))"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{
          transition: "stroke-dashoffset 0.8s ease-out",
        }}
      />
      <text
        x={size / 2}
        y={size / 2}
        dominantBaseline="middle"
        textAnchor="middle"
        fontFamily="var(--font-mono)"
        fontSize={size * 0.18}
        fontWeight={700}
        fill="hsl(var(--foreground))"
      >
        {percentage.toFixed(1)}%
      </text>
    </svg>
  );
}