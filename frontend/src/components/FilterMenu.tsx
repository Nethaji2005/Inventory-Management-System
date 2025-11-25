import React, { useEffect, useRef } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (val: string) => void;
  defaults?: string[];
};

export default function FilterMenu({ open, onClose, onSelect, defaults = ["SILPAULINES", "ROLLS", "HDPE"] }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div ref={ref} className="absolute z-50 mt-2 w-56 bg-white border rounded shadow-lg">
      <div className="px-3 py-2 text-xs text-gray-500">Quick filters</div>
      <div className="divide-y">
        {defaults.map((d) => (
          <button
            key={d}
            onClick={() => { onSelect(d); onClose(); }}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:bg-gray-50"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}
