import { cn } from "@/lib/utils";

interface BalaLogoProps {
  className?: string;
}

export function BalaLogo({ className }: BalaLogoProps) {
  return (
    <svg
      viewBox="0 0 120 140"
      className={cn("text-primary", className)}
      role="img"
      aria-label="Bala Tarpaulins logo"
    >
      <defs>
        <linearGradient id="btGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#123fba" />
          <stop offset="100%" stopColor="#0b2c7a" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
        <path d="M10 60 L60 10 L110 60" />
        <path d="M20 70 L60 30 L100 70" />
        <path d="M30 80 L60 50 L90 80" />
      </g>
      <g fill="url(#btGradient)" fontFamily="'Poppins', 'Segoe UI', sans-serif" fontWeight={700} fontSize="48" textAnchor="middle">
        <text x="50" y="105">B</text>
        <text x="80" y="105">T</text>
      </g>
      <rect x="20" y="110" width="80" height="6" rx="3" fill="#0b2c7a" />
      <text
        x="60"
        y="128"
        fontFamily="'Poppins', 'Segoe UI', sans-serif"
        fontSize="14"
        fontWeight={600}
        textAnchor="middle"
        fill="#0b2c7a"
      >
        BALA TARPAULINS
      </text>
    </svg>
  );
}
