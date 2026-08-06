import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapboxOverlay } from "@deck.gl/mapbox";
import { TileLayer } from "@deck.gl/geo-layers";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import { DataFilterExtension } from "@deck.gl/extensions";
import { PMTiles } from "pmtiles";
import { load } from "@loaders.gl/core";
import { MVTLoader } from "@loaders.gl/mvt";
import { CITY_CONFIG } from "./config";
import { colorForFeature } from "./colors";
import { poiColor } from "./poiColors";

// One shared PMTiles reader for the file's lifetime — it manages its own
// directory/header caching internally, so a single instance should serve
// every tile request rather than re-opening the archive per tile.
const pmtilesInstance = new PMTiles(CITY_CONFIG.pmtilesUrl);
const poiPmtilesInstance = new PMTiles(CITY_CONFIG.poiPmtilesUrl);

export default function MapView({
  colorMode,
  ranges,
  heightFilter,
  scale,
  is3D,
  resetToken,
  showPois,
  onViewCounts,
  onPoiViewCounts,
  onSelectBuilding,
  onMapReady,
  onError,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const mapLoadedRef = useRef(false);
  const seenIdsRef = useRef(new Set());
  const seenPoiIdsRef = useRef(new Set());
  // Latest prop values, read inside stable deck.gl callbacks so we don't need
  // to rebuild the TileLayer (and its tile cache) on every filter tweak.
  const propsRef = useRef({});
  propsRef.current = {
    colorMode,
    ranges,
    heightFilter,
    scale,
    is3D,
    showPois,
    onSelectBuilding,
    onViewCounts,
    onPoiViewCounts,
  };

  useEffect(() => {
    // MapLibre needs WebGL; on devices/browsers without it the constructor
    // either throws or silently produces a canvas that never paints
    // anything, which looks identical to a network failure from the outside.
    let map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: CITY_CONFIG.basemapStyle,
        center: CITY_CONFIG.center,
        zoom: CITY_CONFIG.zoom,
        pitch: CITY_CONFIG.pitch,
        bearing: CITY_CONFIG.bearing,
        antialias: true,
      });
    } catch (err) {
      console.error("Failed to create MapLibre map:", err);
      onError?.(`Failed to initialize the map: ${err.message}`);
      return;
    }
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 140, unit: "metric" }), "bottom-left");

    // MapLibre swallows style/tile network failures into a console error by
    // default, which leaves the map looking like a plain black screen with
    // no way for a user (or us, remotely) to tell what went wrong. Surface it.
    map.on("error", (e) => {
      console.error("MapLibre error:", e?.error || e);
      onError?.(e?.error?.message || "Failed to load the map. Check your network connection.");
    });

    // Some failure modes (e.g. a lost/never-created WebGL context) never
    // fire 'error' or 'load' at all, so fall back to a plain timeout.
    const loadTimeout = setTimeout(() => {
      if (!mapLoadedRef.current) {
        onError?.("The map is taking unusually long to load — it may have failed silently (try reloading).");
      }
    }, 12000);

    const overlay = new MapboxOverlay({ interleaved: false, layers: [] });
    mapRef.current = map;
    overlayRef.current = overlay;

    // The deck.gl overlay canvas is deliberately pointer-events:none (so map
    // dragging isn't blocked), and MapboxOverlay's automatic click-forwarding
    // has proven unreliable here — so picking is done explicitly instead.
    const handleMapClick = (e) => {
      const info = overlayRef.current?.pickObject({ x: e.point.x, y: e.point.y, radius: 3 });
      if (info?.object) propsRef.current.onSelectBuilding(info.object.properties || {});
    };

    const start = () => {
      mapLoadedRef.current = true;
      clearTimeout(loadTimeout);
      map.addControl(overlay);
      map.on("click", handleMapClick);
      rebuildLayer();
      onMapReady?.();
    };
    // Deliberately use 'style.load' (style/sources parsed) rather than
    // 'load' (which additionally waits for the first fully-painted basemap
    // frame). 'load' ties our own same-origin building layer's visibility to
    // the third-party basemap's tile-loading speed for no reason — if the
    // basemap is slow or stuck, 'load' never fires and buildings never show
    // either, even though they have nothing to do with each other.
    if (map.isStyleLoaded()) start();
    else map.once("style.load", start);

    return () => {
      clearTimeout(loadTimeout);
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
      mapLoadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function rebuildLayer() {
    if (!overlayRef.current || !mapLoadedRef.current) return;
    const { colorMode: cm, ranges: rg, heightFilter: hf, scale: sc, is3D: d3, showPois: sp } = propsRef.current;

    const buildingsLayer = new TileLayer({
      id: "buildings",
      minZoom: 10,
      maxZoom: 16,
      tileSize: 512,
      // deck.gl ignores function-reference changes on composite layers for
      // performance, so renderSubLayers alone won't re-run just because these
      // values changed — declaring them here plus updateTriggers below is
      // what actually forces a re-render when a filter/colour mode changes.
      updateTriggers: {
        renderSubLayers: [cm, rg.heightMin, rg.heightMax, rg.areaMin, rg.areaMax, hf[0], hf[1], sc, d3],
      },
      getTileData: async ({ index, signal }) => {
        const { z, x, y } = index;
        const result = await pmtilesInstance.getZxy(z, x, y, signal);
        if (!result?.data) return [];
        const features = await load(result.data, MVTLoader, {
          mvt: { coordinates: "wgs84", tileIndex: { x, y, z } },
          worker: false, // avoid depending on an external CDN for the parser worker at runtime
        });
        return features.filter((f) => f && f.properties);
      },
      renderSubLayers: (subProps) => {
        return new GeoJsonLayer({
          id: `${subProps.id}-geojson`,
          data: subProps.data,
          filled: true,
          stroked: false,
          pickable: true,
          extruded: d3,
          getFillColor: (f) => colorForFeature(f.properties || {}, cm, rg),
          getElevation: (f) => Math.max(2, (f.properties || {}).height || 6) * sc,
          getFilterValue: (f) => (f.properties || {}).height || 0,
          filterRange: [hf[0], hf[1]],
          extensions: [new DataFilterExtension({ filterSize: 1 })],
          updateTriggers: {
            getFillColor: [cm, rg.heightMin, rg.heightMax, rg.areaMin, rg.areaMax],
            getElevation: [d3, sc],
            filterRange: hf,
          },
          onClick: (info) => {
            if (info.object) propsRef.current.onSelectBuilding(info.object.properties);
          },
        });
      },
      onViewportLoad: (tiles) => {
        const counts = {};
        const seen = seenIdsRef.current;
        seen.clear();
        const { heightFilter: hf } = propsRef.current;
        for (const tile of tiles || []) {
          const features = tile?.content;
          if (!Array.isArray(features)) continue;
          for (const f of features) {
            const p = f.properties || {};
            const key = p.id ?? `${p.name || ""}:${p.height}:${p.area_m2}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (p.height < hf[0] || p.height > hf[1]) continue;
            const t = p.typology || "residential";
            counts[t] = (counts[t] || 0) + 1;
          }
        }
        propsRef.current.onViewCounts(counts);
      },
    });

    const layers = [buildingsLayer];

    if (sp) {
      layers.push(
        new TileLayer({
          id: "pois",
          minZoom: 12,
          maxZoom: 16,
          tileSize: 512,
          getTileData: async ({ index, signal }) => {
            const { z, x, y } = index;
            const result = await poiPmtilesInstance.getZxy(z, x, y, signal);
            if (!result?.data) return [];
            const features = await load(result.data, MVTLoader, {
              mvt: { coordinates: "wgs84", tileIndex: { x, y, z } },
              worker: false,
            });
            return features.filter((f) => f && f.properties);
          },
          renderSubLayers: (subProps) => {
            return new ScatterplotLayer({
              id: `${subProps.id}-scatter`,
              data: subProps.data,
              pickable: true,
              radiusUnits: "pixels",
              getPosition: (f) => f.geometry.coordinates,
              getRadius: 5,
              getFillColor: (f) => poiColor(f.properties?.poi_type),
              getLineColor: [20, 20, 20],
              lineWidthUnits: "pixels",
              getLineWidth: 1,
              stroked: true,
              onClick: (info) => {
                if (info.object) propsRef.current.onSelectBuilding(info.object.properties);
              },
            });
          },
          onViewportLoad: (tiles) => {
            const counts = {};
            const seen = seenPoiIdsRef.current;
            seen.clear();
            for (const tile of tiles || []) {
              const features = tile?.content;
              if (!Array.isArray(features)) continue;
              for (const f of features) {
                const p = f.properties || {};
                const key = p.id ?? `${p.name || ""}:${f.geometry?.coordinates?.join(",")}`;
                if (seen.has(key)) continue;
                seen.add(key);
                const t = p.poi_type;
                if (!t) continue;
                counts[t] = (counts[t] || 0) + 1;
              }
            }
            propsRef.current.onPoiViewCounts?.(counts);
          },
        })
      );
    } else {
      propsRef.current.onPoiViewCounts?.({});
    }

    overlayRef.current.setProps({ layers });
  }

  // Rebuild whenever a rendering-affecting prop changes (after the map exists).
  useEffect(() => {
    rebuildLayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorMode, ranges, heightFilter, scale, is3D, showPois]);

  // Reset camera
  useEffect(() => {
    if (!mapRef.current || resetToken === 0) return;
    mapRef.current.easeTo({
      center: CITY_CONFIG.center,
      zoom: CITY_CONFIG.zoom,
      pitch: CITY_CONFIG.pitch,
      bearing: CITY_CONFIG.bearing,
      duration: 600,
    });
  }, [resetToken]);

  return <div ref={containerRef} className="map-container" />;
}
