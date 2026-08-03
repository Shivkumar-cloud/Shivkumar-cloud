export default function ControlsPanel({
  colorMode,
  onColorMode,
  heightFilter,
  onHeightFilter,
  heightBounds,
  scale,
  onScale,
  is3D,
  onToggle3D,
  onReset,
  onAbout,
}) {
  return (
    <div className="controls">
      <label className="control-row">
        <span>Colour</span>
        <select value={colorMode} onChange={(e) => onColorMode(e.target.value)}>
          <option value="typology">Typology</option>
          <option value="height">Height</option>
          <option value="area">Area</option>
        </select>
      </label>

      <div className="control-row height-filter">
        <span>Height (m)</span>
        <input
          type="number"
          min={heightBounds[0]}
          max={heightFilter[1]}
          value={heightFilter[0]}
          onChange={(e) => onHeightFilter([Number(e.target.value), heightFilter[1]])}
        />
        <span className="dash">–</span>
        <input
          type="number"
          min={heightFilter[0]}
          max={heightBounds[1]}
          value={heightFilter[1]}
          onChange={(e) => onHeightFilter([heightFilter[0], Number(e.target.value)])}
        />
      </div>

      <div className="control-row">
        <span>Scale</span>
        <div className="button-group">
          {[1, 2, 3].map((s) => (
            <button key={s} className={scale === s ? "active" : ""} onClick={() => onScale(s)}>
              {s}x
            </button>
          ))}
        </div>
      </div>

      <div className="control-row">
        <button className={`toggle-3d ${is3D ? "active" : ""}`} onClick={onToggle3D}>
          {is3D ? "3D" : "2D"}
        </button>
        <button onClick={onReset}>Reset</button>
        <button onClick={onAbout}>About</button>
      </div>
    </div>
  );
}
