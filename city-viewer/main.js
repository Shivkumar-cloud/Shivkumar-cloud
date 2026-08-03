import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  EXPLORE_METERS_PER_UNIT,
  projectExplore,
  fetchArea,
  geocodePlace,
  geocodeSuggestions,
  ROAD_STYLES,
  decimatePoints,
} from "./osm-explore.js";

const canvas = document.getElementById("scene");
const loadingEl = document.getElementById("loading");
const infoEl = document.getElementById("info");
const citySizeInput = document.getElementById("citySize");
const citySizeValue = document.getElementById("citySizeValue");
const citySizeGroup = document.getElementById("citySizeGroup");
const exploreGroup = document.getElementById("exploreGroup");
const placeSearchInput = document.getElementById("placeSearch");
const searchGoBtn = document.getElementById("search-go");
const suggestionsEl = document.getElementById("searchSuggestions");
const exploreRadiusInput = document.getElementById("exploreRadius");
const exploreRadiusValue = document.getElementById("exploreRadiusValue");
const loadAreaBtn = document.getElementById("load-area");
const exploreStatusEl = document.getElementById("explore-status");
const regenerateBtn = document.getElementById("regenerate");
let suggestDebounceTimer = null;
let suggestToken = 0;

const DISTRICTS = [
  { name: "Downtown", colors: [0x3a4a63, 0x455b7a, 0x54688a, 0x2e3a4f], minFloors: 12, maxFloors: 34 },
  { name: "Residential", colors: [0xb0785a, 0xc9946b, 0xa8683f, 0xd9a878], minFloors: 2, maxFloors: 8 },
  { name: "Industrial", colors: [0x6b7280, 0x8b93a1, 0x5b6270, 0x757c88], minFloors: 1, maxFloors: 4 },
  { name: "Business Park", colors: [0x2f6f6b, 0x3d8b86, 0x4fa8a1, 0x275754], minFloors: 6, maxFloors: 18 },
];

const FLOOR_HEIGHT = 0.9;
const BLOCK_SPACING = 4;
const DEFAULT_EXPLORE_CENTER = { lat: 18.5195, lng: 73.8553 }; // Shaniwar Wada

let renderer, scene, camera, controls;
let cityGroup;
let raycaster, pointer;
let buildings = [];
let landmarkMeshes = [];
let selected = null;
let isDay = true;
let isWireframe = false;
let sunLight, hemiLight, skyMesh, groundMesh;
let mode = "procedural";
let puneRadiusUnits = 40;

let exploreCenter = { ...DEFAULT_EXPLORE_CENTER };
let exploreData = null;

init();

function init() {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
  setDefaultCameraPosition(parseInt(citySizeInput.value, 10));

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 200;
  controls.maxPolarAngle = Math.PI / 2 - 0.02;
  controls.target.set(0, 4, 0);

  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();

  buildSky();
  buildLights();
  buildGround();
  buildCity(parseInt(citySizeInput.value, 10));
  updateModeUI();

  window.addEventListener("resize", onResize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  regenerateBtn.addEventListener("click", () => {
    if (mode === "procedural") buildCity(parseInt(citySizeInput.value, 10));
  });
  document.getElementById("toggle-day").addEventListener("click", toggleDayNight);
  document.getElementById("toggle-wireframe").addEventListener("click", toggleWireframe);
  document.getElementById("reset-camera").addEventListener("click", resetCamera);
  document.getElementById("info-close").addEventListener("click", () => selectEntity(null));
  document.getElementById("mode-procedural").addEventListener("click", () => {
    if (mode === "procedural") return;
    mode = "procedural";
    updateModeUI();
    buildCity(parseInt(citySizeInput.value, 10));
    resetCamera();
  });
  document.getElementById("mode-pune").addEventListener("click", () => {
    if (mode === "pune") return;
    mode = "pune";
    updateModeUI();
    if (exploreData) {
      buildExploreCity();
      resetCamera();
    } else {
      loadArea(exploreCenter, parseInt(exploreRadiusInput.value, 10));
    }
  });
  citySizeInput.addEventListener("input", () => {
    citySizeValue.textContent = citySizeInput.value;
  });
  citySizeInput.addEventListener("change", () => {
    if (mode !== "procedural") return;
    const size = parseInt(citySizeInput.value, 10);
    buildCity(size);
    resetCamera();
  });
  exploreRadiusInput.addEventListener("input", () => {
    exploreRadiusValue.textContent = exploreRadiusInput.value;
  });
  loadAreaBtn.addEventListener("click", () => {
    loadArea(exploreCenter, parseInt(exploreRadiusInput.value, 10));
  });
  searchGoBtn.addEventListener("click", onSearchGo);
  placeSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      hideSuggestions();
      onSearchGo();
    }
  });
  placeSearchInput.addEventListener("input", () => {
    clearTimeout(suggestDebounceTimer);
    const q = placeSearchInput.value.trim();
    if (q.length < 3) {
      hideSuggestions();
      return;
    }
    suggestDebounceTimer = setTimeout(() => loadSuggestions(q), 350);
  });
  placeSearchInput.addEventListener("blur", () => {
    // delay so a suggestion click's mousedown fires before we hide the list
    setTimeout(hideSuggestions, 150);
  });

  onResize();
  requestAnimationFrame(animate);
  loadingEl.classList.add("hidden");
}

function setDefaultCameraPosition(gridSize = 12) {
  const radius = Math.max(30, gridSize * BLOCK_SPACING * 0.95);
  camera.position.set(radius, radius * 0.8, radius);
}

function setCameraRadius(radius) {
  camera.position.set(radius, radius * 0.8, radius);
}

function resetCamera() {
  if (mode === "pune") {
    setCameraRadius(puneRadiusUnits);
  } else {
    setDefaultCameraPosition(parseInt(citySizeInput.value, 10));
  }
  controls.target.set(0, 4, 0);
  controls.update();
}

function updateModeUI() {
  document.getElementById("mode-procedural").classList.toggle("active", mode === "procedural");
  document.getElementById("mode-pune").classList.toggle("active", mode === "pune");
  citySizeGroup.classList.toggle("hidden", mode !== "procedural");
  exploreGroup.classList.toggle("hidden", mode !== "pune");
  regenerateBtn.classList.toggle("hidden", mode !== "procedural");
  controls.minDistance = mode === "pune" ? 2 : 8;
  applyFog();
  if (groundMesh) groundMesh.material.color.set(mode === "pune" ? 0x2f2c26 : 0x3c4a3f);
}

// Fog distance must track the size of whatever's actually loaded — a fixed
// far distance washes the whole scene into haze once a loaded area (or its
// camera distance) exceeds it, which is exactly what happens at large
// "Load radius" settings in Pune mode.
function applyFog() {
  if (mode === "pune") {
    controls.maxDistance = Math.max(120, puneRadiusUnits * 3);
    scene.fog.near = Math.max(8, puneRadiusUnits * 0.3);
    scene.fog.far = Math.max(80, puneRadiusUnits * 2.6);
  } else {
    controls.maxDistance = 200;
    scene.fog.near = 60;
    scene.fog.far = 160;
  }
}

function buildSky() {
  scene.background = new THREE.Color(0x8fc6ff);
  scene.fog = new THREE.Fog(0x8fc6ff, 60, 160);
}

function buildLights() {
  hemiLight = new THREE.HemisphereLight(0xbfe3ff, 0x2b2117, 0.7);
  scene.add(hemiLight);

  sunLight = new THREE.DirectionalLight(0xffffff, 1.1);
  sunLight.position.set(40, 60, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -60;
  sunLight.shadow.camera.right = 60;
  sunLight.shadow.camera.top = 60;
  sunLight.shadow.camera.bottom = -60;
  sunLight.shadow.camera.near = 1;
  sunLight.shadow.camera.far = 150;
  sunLight.shadow.bias = -0.0015;
  scene.add(sunLight);
  scene.add(sunLight.target);
}

function buildGround() {
  const groundGeo = new THREE.PlaneGeometry(400, 400);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x3c4a3f, roughness: 1 });
  groundMesh = new THREE.Mesh(groundGeo, groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);
}

function districtFor(gx, gz, half) {
  const nx = gx < 0 ? 0 : 1;
  const nz = gz < 0 ? 0 : 1;
  const idx = nx * 2 + nz;
  return DISTRICTS[idx % DISTRICTS.length];
}

function clearCity() {
  if (cityGroup) {
    scene.remove(cityGroup);
    disposeGroup(cityGroup);
  }
  buildings = [];
  landmarkMeshes = [];
  selectEntity(null);
  cityGroup = new THREE.Group();
}

function buildCity(gridSize) {
  clearCity();
  const half = Math.floor(gridSize / 2);

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.9 });
  const roadSize = gridSize * BLOCK_SPACING + BLOCK_SPACING;
  const roadGeoX = new THREE.PlaneGeometry(roadSize, 0.9);
  const roadGeoZ = new THREE.PlaneGeometry(0.9, roadSize);

  for (let i = -half; i <= half; i++) {
    const lineX = new THREE.Mesh(roadGeoX, roadMat);
    lineX.rotation.x = -Math.PI / 2;
    lineX.position.set(0, 0.01, i * BLOCK_SPACING);
    lineX.receiveShadow = true;
    cityGroup.add(lineX);

    const lineZ = new THREE.Mesh(roadGeoZ, roadMat);
    lineZ.rotation.x = -Math.PI / 2;
    lineZ.position.set(i * BLOCK_SPACING, 0.01, 0);
    lineZ.receiveShadow = true;
    cityGroup.add(lineZ);
  }

  for (let gx = -half; gx < half; gx++) {
    for (let gz = -half; gz < half; gz++) {
      if (Math.random() < 0.12) continue; // occasional empty lot / plaza

      const district = districtFor(gx, gz, half);
      const floors = Math.floor(
        district.minFloors + Math.random() * (district.maxFloors - district.minFloors)
      );
      const height = Math.max(1, floors) * FLOOR_HEIGHT;
      const width = 1.6 + Math.random() * 1.1;
      const depth = 1.6 + Math.random() * 1.1;
      const color = district.colors[Math.floor(Math.random() * district.colors.length)];

      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        metalness: 0.1,
        wireframe: isWireframe,
      });
      const mesh = new THREE.Mesh(geo, mat);

      const cx = gx * BLOCK_SPACING + BLOCK_SPACING / 2 + (Math.random() - 0.5) * 0.5;
      const cz = gz * BLOCK_SPACING + BLOCK_SPACING / 2 + (Math.random() - 0.5) * 0.5;
      mesh.position.set(cx, height / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      mesh.userData = {
        isBuilding: true,
        height: height.toFixed(1),
        floors,
        footprint: `${width.toFixed(1)}m × ${depth.toFixed(1)}m`,
        district: district.name,
        baseColor: color,
      };

      cityGroup.add(mesh);
      buildings.push(mesh);

      if (Math.random() < 0.5) {
        addRooftopDetail(mesh, width, depth, height);
      }
    }
  }

  scene.add(cityGroup);
}

function addRooftopDetail(building, width, depth, height) {
  const detailGeo = new THREE.BoxGeometry(width * 0.3, 0.4, depth * 0.3);
  const detailMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.8 });
  const detail = new THREE.Mesh(detailGeo, detailMat);
  detail.position.set(building.position.x, height / 2 + 0.2 + building.position.y - height / 2, building.position.z);
  detail.position.y = building.position.y + height / 2 + 0.2;
  detail.castShadow = true;
  cityGroup.add(detail);
}

// ---------------------------------------------------------------------------
// Real Pune explorer — everything below renders live OpenStreetMap data for
// whatever area the user has searched for or loaded. No random/dummy geometry.
// ---------------------------------------------------------------------------

async function onSearchGo() {
  const query = placeSearchInput.value.trim();
  if (!query) {
    exploreStatusEl.textContent = "Type a place name first.";
    return;
  }
  searchGoBtn.disabled = true;
  exploreStatusEl.textContent = `Searching for "${query}"…`;
  try {
    const place = await geocodePlace(query);
    exploreStatusEl.textContent = `Found: ${place.displayName}. Loading…`;
    await loadArea({ lat: place.lat, lng: place.lng }, parseInt(exploreRadiusInput.value, 10));
  } catch (err) {
    exploreStatusEl.textContent = `Search failed: ${err.message}`;
  } finally {
    searchGoBtn.disabled = false;
  }
}

async function loadSuggestions(query) {
  const token = ++suggestToken;
  try {
    const results = await geocodeSuggestions(query, 5);
    if (token !== suggestToken) return; // a newer keystroke already superseded this request
    renderSuggestions(results);
  } catch {
    if (token === suggestToken) hideSuggestions();
  }
}

function renderSuggestions(results) {
  if (!results.length) {
    hideSuggestions();
    return;
  }
  suggestionsEl.innerHTML = "";
  for (const r of results) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "suggestion-item";
    item.textContent = r.displayName;
    item.addEventListener("mousedown", (e) => {
      e.preventDefault(); // keep the input focused so blur-hide doesn't race this click
      placeSearchInput.value = r.displayName;
      hideSuggestions();
      loadArea({ lat: r.lat, lng: r.lng }, parseInt(exploreRadiusInput.value, 10));
    });
    suggestionsEl.appendChild(item);
  }
  suggestionsEl.classList.remove("hidden");
}

function hideSuggestions() {
  suggestionsEl.classList.add("hidden");
  suggestionsEl.innerHTML = "";
}

async function loadArea(center, radiusMeters) {
  loadAreaBtn.disabled = true;
  exploreStatusEl.textContent = `Loading real map data within ${radiusMeters}m…`;
  try {
    const data = await fetchArea(center, radiusMeters);
    exploreData = data;
    exploreCenter = center;
    puneRadiusUnits = Math.max(15, (radiusMeters / EXPLORE_METERS_PER_UNIT) * 1.2);
    applyFog();
    buildExploreCity();
    resetCamera();
    exploreStatusEl.textContent =
      `Loaded ${data.buildings.length} buildings, ${data.roads.length} roads/paths, ` +
      `${data.railways.length} rail lines, ${data.busStops.length} bus stops, ` +
      `${data.trainStations.length} stations, ${data.parks.length + data.water.length} green/water areas.`;
  } catch (err) {
    exploreStatusEl.textContent = `Couldn't load OpenStreetMap data: ${err.message}`;
  } finally {
    loadAreaBtn.disabled = false;
  }
}

function buildExploreCity() {
  clearCity();
  if (!exploreData) {
    scene.add(cityGroup);
    return;
  }

  const origin = exploreCenter;

  for (const area of exploreData.parks) addAreaPatch(area, origin, 0x3f6b3a, "Park");
  for (const area of exploreData.water) addAreaPatch(area, origin, 0x2f6f9e, "Water");

  for (const road of exploreData.roads) addLineFeature(road.points, origin, ROAD_STYLES[road.kind] || ROAD_STYLES.DEFAULT, 0.01);
  for (const rail of exploreData.railways) addLineFeature(rail.points, origin, { width: 0.9, color: 0x4a4038 }, 0.015);

  for (const b of exploreData.buildings) addExploreBuilding(b, origin);

  for (const stop of exploreData.busStops) {
    addPointMarker(stop, origin, { color: 0xffb400, height: 0.6, title: stop.name || "Bus Stop", description: "Bus stop (OpenStreetMap)." });
  }
  for (const st of exploreData.trainStations) {
    addPointMarker(st, origin, { color: 0x2f6fbf, height: 1.0, title: st.name || "Train Station", description: "Railway station (OpenStreetMap)." });
  }

  scene.add(cityGroup);
}

function buildingColor(type) {
  switch (type) {
    case "house":
    case "detached":
    case "residential":
      return 0xc9946b;
    case "apartments":
      return 0x8a93a1;
    case "commercial":
    case "retail":
    case "office":
      return 0x3d8b86;
    case "industrial":
    case "warehouse":
      return 0x6b7280;
    case "religious":
    case "temple":
    case "church":
    case "mosque":
      return 0xd9c9a3;
    default:
      return 0xb9ac95;
  }
}

function addExploreBuilding(b, origin) {
  const shape = new THREE.Shape();
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  b.ring.forEach((pt, i) => {
    const { x, z } = projectExplore(pt.lat, pt.lng, origin);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();

  const heightMeters = b.heightMeters || (b.levels ? b.levels * 3 : 6);
  const height = Math.max(0.25, heightMeters / EXPLORE_METERS_PER_UNIT);

  let geometry;
  try {
    geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  } catch {
    return; // a handful of OSM ways are self-intersecting/degenerate; skip those
  }
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({ color: buildingColor(b.type), roughness: 0.7, wireframe: isWireframe });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const floors = b.levels ? Math.round(b.levels) : Math.max(1, Math.round(heightMeters / 3));
  const footprintW = (maxX - minX) * EXPLORE_METERS_PER_UNIT;
  const footprintD = (maxZ - minZ) * EXPLORE_METERS_PER_UNIT;

  mesh.userData = {
    isBuilding: true,
    title: b.name || "Building",
    height: heightMeters.toFixed(1),
    floors,
    footprint: `${footprintW.toFixed(0)}m × ${footprintD.toFixed(0)}m`,
    district: b.type || "unknown",
    description: "Real building footprint from OpenStreetMap.",
  };

  cityGroup.add(mesh);
  buildings.push(mesh);
}

function addAreaPatch(area, origin, color, label) {
  const shape = new THREE.Shape();
  area.ring.forEach((pt, i) => {
    const { x, z } = projectExplore(pt.lat, pt.lng, origin);
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();

  let geometry;
  try {
    geometry = new THREE.ShapeGeometry(shape);
  } catch {
    return;
  }
  geometry.rotateX(-Math.PI / 2);

  const material = new THREE.MeshStandardMaterial({ color, roughness: 1, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0.008;
  mesh.receiveShadow = true;
  mesh.userData = {
    isLandmark: true,
    title: area.name || label,
    description: `${label} area, from OpenStreetMap.`,
  };
  cityGroup.add(mesh);
  landmarkMeshes.push(mesh);
}

function addLineFeature(points, origin, style, y) {
  const projected = decimatePoints(points, 60).map((pt) => projectExplore(pt.lat, pt.lng, origin));
  const mat = new THREE.MeshStandardMaterial({ color: style.color, roughness: 0.9 });
  for (let i = 0; i < projected.length - 1; i++) {
    addSegment(mat, projected[i], projected[i + 1], style.width, y);
  }
}

function addSegment(mat, p1, p2, width, y) {
  const dx = p2.x - p1.x;
  const dz = p2.z - p1.z;
  const length = Math.hypot(dx, dz);
  if (length < 0.02) return;

  const geo = new THREE.PlaneGeometry(length, width);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.rotation.z = -Math.atan2(dz, dx);
  mesh.position.set((p1.x + p2.x) / 2, y, (p1.z + p2.z) / 2);
  mesh.receiveShadow = true;
  cityGroup.add(mesh);
}

function addPointMarker(node, origin, { color, height, title, description }) {
  const { x, z } = projectExplore(node.lat, node.lng, origin);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, height, 6), mat);
  pole.position.set(x, height / 2, z);
  pole.castShadow = true;

  const sign = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.18), mat);
  sign.position.set(x, height + 0.03, z);
  sign.castShadow = true;

  const userData = { isLandmark: true, title, description };
  pole.userData = userData;
  sign.userData = userData;

  cityGroup.add(pole, sign);
  landmarkMeshes.push(pole, sign);
}

function disposeGroup(group) {
  group.traverse((obj) => {
    if (obj.geometry) obj.geometry.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
      else obj.material.dispose();
    }
  });
}

function toggleWireframe() {
  isWireframe = !isWireframe;
  buildings.forEach((b) => {
    b.material.wireframe = isWireframe;
  });
  landmarkMeshes.forEach((m) => {
    m.material.wireframe = isWireframe;
  });
}

function toggleDayNight() {
  isDay = !isDay;
  if (isDay) {
    scene.background = new THREE.Color(0x8fc6ff);
    scene.fog.color = new THREE.Color(0x8fc6ff);
    hemiLight.intensity = 0.7;
    sunLight.intensity = 1.1;
    sunLight.color.set(0xffffff);
  } else {
    scene.background = new THREE.Color(0x050814);
    scene.fog.color = new THREE.Color(0x050814);
    hemiLight.intensity = 0.15;
    sunLight.intensity = 0.25;
    sunLight.color.set(0x8fa8ff);
  }
}

function onPointerDown(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(pointer, camera);
  const intersects = raycaster.intersectObjects([...buildings, ...landmarkMeshes], false);

  if (intersects.length > 0) {
    selectEntity(intersects[0].object);
  } else {
    selectEntity(null);
  }
}

function selectEntity(mesh) {
  if (selected) {
    selected.material.emissive?.setHex(0x000000);
  }

  selected = mesh;

  if (!mesh) {
    infoEl.classList.add("hidden");
    return;
  }

  mesh.material.emissive = new THREE.Color(0x5fb4ff);
  mesh.material.emissiveIntensity = 0.35;

  const data = mesh.userData;
  document.getElementById("info-title").textContent = data.title || `${data.district} Building`;

  const statsEl = document.getElementById("info-stats");
  const descEl = document.getElementById("info-description");

  if (data.isLandmark) {
    statsEl.classList.add("hidden");
    descEl.textContent = data.description || "";
    descEl.classList.remove("hidden");
  } else {
    statsEl.classList.remove("hidden");
    document.getElementById("info-height").textContent = `${data.height} m`;
    document.getElementById("info-floors").textContent = data.floors;
    document.getElementById("info-footprint").textContent = data.footprint;
    document.getElementById("info-district").textContent = data.district;
    if (data.description) {
      descEl.textContent = data.description;
      descEl.classList.remove("hidden");
    } else {
      descEl.classList.add("hidden");
    }
  }

  infoEl.classList.remove("hidden");
}

function onResize() {
  const { innerWidth, innerHeight } = window;
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
