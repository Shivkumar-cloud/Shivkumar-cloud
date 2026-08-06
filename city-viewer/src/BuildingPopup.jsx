export default function BuildingPopup({ building, onClose }) {
  if (!building) return null;

  if (building.poi_type) {
    return (
      <aside className="popup">
        <button className="popup-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        <h2>{building.name || building.poi_type_label}</h2>
        <dl>
          <dt>Type</dt>
          <dd>{building.poi_type_label}</dd>
          <dt>Source</dt>
          <dd>{building.source}</dd>
        </dl>
      </aside>
    );
  }

  return (
    <aside className="popup">
      <button className="popup-close" onClick={onClose} aria-label="Close">
        &times;
      </button>
      <h2>{building.name || building.typology_label}</h2>
      <dl>
        <dt>Typology</dt>
        <dd>{building.typology_label}</dd>
        <dt>Height</dt>
        <dd>{building.height} m</dd>
        <dt>Area</dt>
        <dd>{Math.round(building.area_m2).toLocaleString()} m²</dd>
        <dt>Type source</dt>
        <dd>{building.typo_src === "osm" ? "OSM tag" : "Heuristic default"}</dd>
        <dt>Source</dt>
        <dd>{building.source}</dd>
      </dl>
    </aside>
  );
}
