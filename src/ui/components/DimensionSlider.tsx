import { asScale } from "@/domain/model";
import type { Scale } from "@/domain/types";
import { polarityLabel, type DimensionMeta } from "@/data/dimensions";
import { useState } from "react";

export function DimensionSlider({
  meta,
  value,
  onChange,
  changed = false,
  idPrefix = "dim",
}: {
  meta: DimensionMeta;
  value: Scale;
  onChange: (next: Scale) => void;
  changed?: boolean;
  idPrefix?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = `${idPrefix}-${meta.key}`;

  return (
    <div className={changed ? "dim changed" : "dim"}>
      <div className="dim-head">
        <label htmlFor={id}>{meta.name}</label>
        <span className="dim-val">
          {value}/5
          {changed ? " · moved" : ""}
        </span>
      </div>
      <p className="dim-def">{meta.definition}</p>
      <input
        id={id}
        type="range"
        min={1}
        max={5}
        step={1}
        value={value}
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-label={`${meta.name}. ${meta.low} to ${meta.high}.`}
        onChange={(event) => onChange(asScale(Number(event.target.value)))}
      />
      <div className="dim-meta">
        <span>{meta.low}</span>
        <span>{meta.high}</span>
      </div>
      <span className={`polarity ${meta.polarity}`}>{polarityLabel(meta.polarity)}</span>
      <div>
        <button type="button" className="why-btn" onClick={() => setOpen((v) => !v)}>
          {open ? "Close" : "Why this matters"}
        </button>
        {open ? <p className="why-copy">{meta.why}</p> : null}
      </div>
    </div>
  );
}
