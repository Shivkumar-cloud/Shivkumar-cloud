import { TYPOLOGY_ORDER, typologyDefs, typologyColor } from "./colors";
import { POI_TYPE_ORDER, poiDefs, poiHexColor } from "./poiColors";

export default function Legend({ viewCounts, zoomedIn, poi }) {
  const order = poi ? POI_TYPE_ORDER : TYPOLOGY_ORDER;
  const defs = poi ? poiDefs : typologyDefs;
  const colorOf = poi ? poiHexColor : typologyColor;

  return (
    <div className="legend">
      <div className="legend-title">
        {poi ? "Traffic / POIs" : "Typologies"} {zoomedIn && <span className="legend-hint">— in view</span>}
      </div>
      <ul className="legend-list">
        {order.map((id) => (
          <li key={id} className="legend-row">
            <span className="legend-swatch" style={{ background: colorOf(id) }} />
            <span className="legend-label">{defs[id].label}</span>
            <span className="legend-count">{zoomedIn ? (viewCounts[id] || 0).toLocaleString() : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
