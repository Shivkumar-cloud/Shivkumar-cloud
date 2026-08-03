export default function AboutModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="popup-close" onClick={onClose} aria-label="Close">
          &times;
        </button>
        <h2>About this map</h2>
        <p>
          A 3D building-typology explorer built from real{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">
            OpenStreetMap
          </a>{" "}
          data, © OpenStreetMap contributors, available under the{" "}
          <a href="https://opendatacommons.org/licenses/odbl/" target="_blank" rel="noopener">
            Open Database License
          </a>
          .
        </p>
        <h3>Methodology</h3>
        <ul>
          <li>Building footprints and tags fetched from OpenStreetMap.</li>
          <li>
            Each building is classified into a typology using a heuristic based on its OSM tags
            (building, amenity, shop, leisure, landuse, tourism, historic, office, power, man_made,
            railway, aeroway). Buildings tagged explicitly are marked "OSM tag"; untagged/generic
            buildings default to Residential, marked "Heuristic default".
          </li>
          <li>
            Height uses the OSM <code>height</code> tag when present, else{" "}
            <code>building:levels × 3.5m</code>, else a per-typology default.
          </li>
          <li>Area is computed from the footprint geometry.</li>
        </ul>
        <p className="modal-note">
          Data is tiled offline into a single PMTiles file and streamed into the browser as vector
          tiles — nothing is loaded or computed over the full dataset at render time.
        </p>
      </div>
    </div>
  );
}
