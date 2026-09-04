import { useEffect, useMemo, useRef, useState } from "react";

export interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette({
  open,
  items,
  onClose,
}: {
  open: boolean;
  items: CommandItem[];
  onClose: () => void;
}) {
  if (!open) return null;
  return <PalettePanel items={items} onClose={onClose} />;
}

function PalettePanel({ items, onClose }: { items: CommandItem[]; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const returnFocus = useRef<HTMLElement | null>(
    typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null,
  );
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items;
  }, [items, query]);
  const index = filtered.length === 0 ? 0 : Math.min(active, filtered.length - 1);

  const close = () => {
    const target = returnFocus.current;
    onClose();
    queueMicrotask(() => target?.focus?.());
  };

  useEffect(() => {
    document.querySelector<HTMLElement>(".palette-list [data-active='true']")?.scrollIntoView({ block: "nearest" });
  }, [index, filtered.length]);

  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={close}>
      <div className="palette-panel" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          value={query}
          placeholder="Command"
          aria-label="Filter commands"
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
            if (event.key === "Tab") {
              event.preventDefault();
              const dir = event.shiftKey ? -1 : 1;
              setActive((i) => (i + dir + Math.max(filtered.length, 1)) % Math.max(filtered.length, 1));
            }
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActive((i) => (i + 1) % Math.max(filtered.length, 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActive((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
            }
            if (event.key === "Enter" && filtered[index]) {
              filtered[index].run();
              close();
            }
          }}
        />
        <div className="palette-list" role="listbox" aria-label="Commands">
          {filtered.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={i === index}
              data-active={i === index}
              onMouseEnter={() => setActive(i)}
              onClick={() => {
                item.run();
                close();
              }}
            >
              {item.label}
              {item.hint ? <span className="hint">{` · ${item.hint}`}</span> : null}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="hint" style={{ padding: 16 }}>
            No matching command.
          </p>
        ) : null}
      </div>
    </div>
  );
}
