export const CITY_CONFIG = {
  name: "Pune",
  center: [73.8553, 18.5195], // Shaniwar Wada
  zoom: 13,
  pitch: 45,
  bearing: 0,
  pmtilesUrl: `${import.meta.env.BASE_URL}buildings.pmtiles`,
  poiPmtilesUrl: `${import.meta.env.BASE_URL}pois.pmtiles`,
  // CARTO's Dark Matter style JSON loads fine but its tiles proved
  // unreliable in practice (most never completed loading for some
  // users/networks). OpenFreeMap is a different CDN with no API key
  // required and has been reliable where CARTO wasn't.
  basemapStyle: "https://tiles.openfreemap.org/styles/liberty",
};
