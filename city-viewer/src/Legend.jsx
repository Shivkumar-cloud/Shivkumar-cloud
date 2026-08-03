import { TYPOLOGY_ORDER, typologyDefs, typologyColor } from "./colors";

export default function Legend({ viewCounts, zoomedIn }) {
  return (
    <div className="legend">
      <div className="legend-title">
        Typologies {zoomedIn && <span className="legend-hint">— in view</span>}
      </div>
      <ul className="legend-list">
        {TYPOLOGY_ORDER.map((id) => (
          <li key={id} className="legend-row">
            <span className="legend-swatch" style={{ background: typologyColor(id) }} />
            <span className="legend-label">{typologyDefs[id].label}</span>
            <span className="legend-count">{zoomedIn ? (viewCounts[id] || 0).toLocaleString() : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
