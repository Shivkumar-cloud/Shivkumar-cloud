import { useEffect, useMemo, useState } from "react";
import { PMTiles } from "pmtiles";
import MapView from "./MapView";
import Legend from "./Legend";
import ControlsPanel from "./ControlsPanel";
import BuildingPopup from "./BuildingPopup";
import AboutModal from "./AboutModal";
import { CITY_CONFIG } from "./config";
import "./app.css";

export default function App() {
  const [totalCount, setTotalCount] = useState(null);
  const [heightBounds, setHeightBounds] = useState([0, 60]);
  const [areaBounds, setAreaBounds] = useState([0, 2000]);

  const [colorMode, setColorMode] = useState("typology");
  const [heightFilter, setHeightFilter] = useState([0, 60]);
  const [scale, setScale] = useState(1);
  const [is3D, setIs3D] = useState(true);
  const [resetToken, setResetToken] = useState(0);
  const [aboutOpen, setAboutOpen] = useState(false);

  const [viewCounts, setViewCounts] = useState({});
  const [selectedBuilding, setSelectedBuilding] = useState(null);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    const p = new PMTiles(CITY_CONFIG.pmtilesUrl);
    p.getMetadata()
      .then((meta) => {
        const count = meta?.tilestats?.layers?.[0]?.count;
        if (typeof count === "number") setTotalCount(count);

        const heightAttr = meta?.tilestats?.layers?.[0]?.attributes?.find((a) => a.attribute === "height");
        if (heightAttr) {
          const bounds = [Math.floor(heightAttr.min), Math.ceil(heightAttr.max)];
          setHeightBounds(bounds);
          setHeightFilter(bounds);
        }
        const areaAttr = meta?.tilestats?.layers?.[0]?.attributes?.find((a) => a.attribute === "area_m2");
        if (areaAttr) setAreaBounds([Math.floor(areaAttr.min), Math.ceil(areaAttr.max)]);
      })
      .catch(() => {
        /* metadata is a nice-to-have; the map still works without it */
      });
  }, []);

  const ranges = useMemo(
    () => ({
      heightMin: heightBounds[0],
      heightMax: heightBounds[1],
      areaMin: areaBounds[0],
      areaMax: areaBounds[1],
    }),
    [heightBounds, areaBounds]
  );

  return (
    <div className="app-root">
      <MapView
        colorMode={colorMode}
        ranges={ranges}
        heightFilter={heightFilter}
        scale={scale}
        is3D={is3D}
        resetToken={resetToken}
        onViewCounts={setViewCounts}
        onSelectBuilding={setSelectedBuilding}
      />

      <header className="title-panel">
        <h1>{CITY_CONFIG.name}</h1>
        <p>{totalCount != null ? `${totalCount.toLocaleString()} buildings` : "Loading…"}</p>
      </header>

      <button className="panel-toggle" onClick={() => setPanelOpen((v) => !v)}>
        {panelOpen ? "Hide panel" : "Show panel"}
      </button>

      <div className={`side-panel ${panelOpen ? "open" : "closed"}`}>
        <ControlsPanel
          colorMode={colorMode}
          onColorMode={setColorMode}
          heightFilter={heightFilter}
          onHeightFilter={setHeightFilter}
          heightBounds={heightBounds}
          scale={scale}
          onScale={setScale}
          is3D={is3D}
          onToggle3D={() => setIs3D((v) => !v)}
          onReset={() => {
            setResetToken((t) => t + 1);
            setHeightFilter(heightBounds);
            setColorMode("typology");
            setScale(1);
            setIs3D(true);
          }}
          onAbout={() => setAboutOpen(true)}
        />
        <Legend viewCounts={viewCounts} zoomedIn={Object.keys(viewCounts).length > 0} />
      </div>

      <BuildingPopup building={selectedBuilding} onClose={() => setSelectedBuilding(null)} />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}
