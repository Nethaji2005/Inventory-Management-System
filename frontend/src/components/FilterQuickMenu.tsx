import React, { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (val: string) => void;
  defaults?: string[];
  className?: string;
};

export default function FilterQuickMenu({
  open,
  onClose,
  onSelect,
  defaults = ["SILPAULINES", "ROLLS", "HDPE"],
  className = "",
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleDoc);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleDoc);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className={`z-50 w-48 bg-white border rounded shadow ${className}`} role="menu" aria-label="Quick filters">
      <div className="px-3 py-2 text-xs text-gray-500">Quick filters</div>
      <div className="divide-y">
        {defaults.map(d => (
          <button
            key={d}
            onClick={() => { onSelect(d); onClose(); }}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:outline-none focus:bg-gray-50"
            role="menuitem"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
