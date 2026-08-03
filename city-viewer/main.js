import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PUNE_ORIGIN, PUNE_DISTRICTS, PUNE_LANDMARKS, DISTRICT_PROFILES, projectLatLng } from "./pune-data.js";
import { CORE_METERS_PER_UNIT, projectCore, fetchOsmBuildings } from "./osm-buildings.js";

const canvas = document.getElementById("scene");
const loadingEl = document.getElementById("loading");
const infoEl = document.getElementById("info");
const citySizeInput = document.getElementById("citySize");
const citySizeValue = document.getElementById("citySizeValue");
const citySizeGroup = document.getElementById("citySizeGroup");
const googleGroup = document.getElementById("googleGroup");
const googleKeyInput = document.getElementById("googleKey");
const fetchRoadsBtn = document.getElementById("fetch-roads");
const roadsStatusEl = document.getElementById("roads-status");
const GOOGLE_KEY_STORAGE = "puneGoogleMapsKey";
const fetchOsmBtn = document.getElementById("fetch-osm");
const osmStatusEl = document.getElementById("osm-status");

const DISTRICTS = [
  { name: "Downtown", colors: [0x3a4a63, 0x455b7a, 0x54688a, 0x2e3a4f], minFloors: 12, maxFloors: 34 },
  { name: "Residential", colors: [0xb0785a, 0xc9946b, 0xa8683f, 0xd9a878], minFloors: 2, maxFloors: 8 },
  { name: "Industrial", colors: [0x6b7280, 0x8b93a1, 0x5b6270, 0x757c88], minFloors: 1, maxFloors: 4 },
  { name: "Business Park", colors: [0x2f6f6b, 0x3d8b86, 0x4fa8a1, 0x275754], minFloors: 6, maxFloors: 18 },
];

const FLOOR_HEIGHT = 0.9;
const BLOCK_SPACING = 4;

let renderer, scene, camera, controls;
let cityGroup;
let raycaster, pointer;
let buildings = [];
let landmarkMeshes = [];
let selected = null;
let isDay = true;
let isWireframe = false;
let sunLight, hemiLight, skyMesh;
let mode = "procedural";
let puneRadiusUnits = 90;
let currentRoadPaths = {};
let googleMapsLoadPromise = null;
let osmBuildingsData = null;
let osmBuildingMeshes = [];

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
  document.getElementById("regenerate").addEventListener("click", () => {
    if (mode === "pune") {
      buildPuneCity();
    } else {
      buildCity(parseInt(citySizeInput.value, 10));
    }
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
    buildPuneCity();
    resetCamera();
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
  fetchRoadsBtn.addEventListener("click", onFetchRoadsClick);
  fetchOsmBtn.addEventListener("click", onFetchOsmClick);

  const savedKey = localStorage.getItem(GOOGLE_KEY_STORAGE);
  if (savedKey) googleKeyInput.value = savedKey;

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
  googleGroup.classList.toggle("hidden", mode !== "pune");
  controls.maxDistance = mode === "pune" ? 350 : 200;
  scene.fog.near = mode === "pune" ? 40 : 60;
  scene.fog.far = mode === "pune" ? 260 : 160;
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
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
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

function buildPuneCity(roadPaths = currentRoadPaths) {
  clearCity();
  currentRoadPaths = roadPaths;

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.9 });

  // Trunk roads from the historic center (Shaniwar Wada, at the origin) out to
  // every district and landmark. Uses a real Google-routed polyline when one
  // has been fetched for that place, otherwise falls back to a straight line
  // along the real-world bearing.
  const allPlaces = [
    ...PUNE_DISTRICTS.map((d) => ({ ...d, kind: "district" })),
    ...PUNE_LANDMARKS.filter((l) => l.id !== "shaniwarwada").map((l) => ({ ...l, kind: "landmark" })),
  ];

  let maxDist = 40;
  for (const place of allPlaces) {
    const { x, z } = projectLatLng(place.lat, place.lng);
    place._x = x;
    place._z = z;
    maxDist = Math.max(maxDist, Math.hypot(x, z));

    const path = roadPaths[place.id];
    if (path && path.length >= 2) {
      buildRoadPath(roadMat, path);
    } else {
      buildTrunkRoad(roadMat, 0, 0, x, z);
    }
  }
  puneRadiusUnits = Math.min(300, Math.max(50, maxDist * 1.1));

  for (const district of allPlaces.filter((p) => p.kind === "district")) {
    buildDistrictCluster(district);
  }

  for (const landmark of PUNE_LANDMARKS) {
    // Skip the stylized fort placeholder once real OSM footprints are loaded —
    // they cover the same ground and would otherwise overlap/z-fight.
    if (landmark.id === "shaniwarwada" && osmBuildingsData) continue;
    const { x, z } = landmark.id === "shaniwarwada" ? { x: 0, z: 0 } : projectLatLng(landmark.lat, landmark.lng);
    buildLandmark(landmark, x, z);
  }

  scene.add(cityGroup);
  renderOsmBuildings();
}

function buildTrunkRoad(roadMat, x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  if (length < 0.5) return;

  const roadGeo = new THREE.PlaneGeometry(length, 1.4);
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.rotation.z = -Math.atan2(dz, dx);
  road.position.set((x1 + x2) / 2, 0.01, (z1 + z2) / 2);
  road.receiveShadow = true;
  cityGroup.add(road);
}

function buildRoadPath(roadMat, points) {
  for (let i = 0; i < points.length - 1; i++) {
    buildTrunkRoad(roadMat, points[i].x, points[i].z, points[i + 1].x, points[i + 1].z);
  }
}

function decimatePath(points, maxPoints = 40) {
  if (points.length <= maxPoints) return points;
  const step = Math.ceil(points.length / maxPoints);
  const result = points.filter((_, i) => i % step === 0);
  if (result[result.length - 1] !== points[points.length - 1]) result.push(points[points.length - 1]);
  return result;
}

function loadGoogleMapsScript(apiKey) {
  if (window.google && window.google.maps && window.google.maps.DirectionsService) {
    return Promise.resolve();
  }
  if (googleMapsLoadPromise) return googleMapsLoadPromise;

  googleMapsLoadPromise = new Promise((resolve, reject) => {
    const callbackName = "__puneGoogleMapsReady";
    window[callbackName] = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}&loading=async`;
    script.async = true;
    script.onerror = () => {
      googleMapsLoadPromise = null;
      reject(new Error("Couldn't load the Google Maps script (check your network and API key)."));
    };
    document.head.appendChild(script);
  });
  return googleMapsLoadPromise;
}

function fetchRoutePoints(directionsService, origin, destination) {
  return new Promise((resolve, reject) => {
    directionsService.route(
      { origin, destination, travelMode: google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === "OK" && result.routes[0]) {
          resolve(result.routes[0].overview_path.map((p) => ({ lat: p.lat(), lng: p.lng() })));
        } else {
          reject(new Error(status));
        }
      }
    );
  });
}

async function fetchAllGoogleRoads(apiKey) {
  await loadGoogleMapsScript(apiKey);
  const directionsService = new google.maps.DirectionsService();

  const targets = [
    ...PUNE_DISTRICTS.map((d) => ({ id: d.id, name: d.name, lat: d.lat, lng: d.lng })),
    ...PUNE_LANDMARKS.filter((l) => l.id !== "shaniwarwada").map((l) => ({ id: l.id, name: l.name, lat: l.lat, lng: l.lng })),
  ];

  const roads = {};
  const failed = [];
  for (const target of targets) {
    try {
      const path = await fetchRoutePoints(directionsService, PUNE_ORIGIN, { lat: target.lat, lng: target.lng });
      roads[target.id] = decimatePath(path.map((p) => projectLatLng(p.lat, p.lng)));
    } catch (err) {
      failed.push({ name: target.name, reason: err.message });
    }
  }
  return { roads, succeeded: targets.length - failed.length, total: targets.length, failed };
}

async function onFetchRoadsClick() {
  const apiKey = googleKeyInput.value.trim();
  if (!apiKey) {
    roadsStatusEl.textContent = "Enter an API key first.";
    return;
  }
  localStorage.setItem(GOOGLE_KEY_STORAGE, apiKey);

  fetchRoadsBtn.disabled = true;
  roadsStatusEl.textContent = "Loading real roads from Google…";
  try {
    const { roads, succeeded, total, failed } = await fetchAllGoogleRoads(apiKey);
    buildPuneCity(roads);
    if (succeeded === 0) {
      const reason = failed[0]?.reason || "unknown error";
      roadsStatusEl.textContent =
        `Google didn't return any routes (${reason}) — check the API key is valid, billing is enabled, and Maps JavaScript API + Directions API are turned on for it.`;
    } else {
      roadsStatusEl.textContent =
        `Loaded ${succeeded}/${total} real routes from Google.` +
        (failed.length ? ` Couldn't route to: ${failed.map((f) => `${f.name} (${f.reason})`).join(", ")}.` : "");
    }
  } catch (err) {
    roadsStatusEl.textContent = `Couldn't load Google Maps: ${err.message}`;
  } finally {
    fetchRoadsBtn.disabled = false;
  }
}

function clearOsmBuildingMeshes() {
  for (const mesh of osmBuildingMeshes) {
    if (cityGroup) cityGroup.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
    const li = landmarkMeshes.indexOf(mesh);
    if (li !== -1) landmarkMeshes.splice(li, 1);
  }
  osmBuildingMeshes = [];
}

function addOsmBuildingMesh(b) {
  const shape = new THREE.Shape();
  b.ring.forEach((pt, i) => {
    const { x, z } = projectCore(pt.lat, pt.lng, PUNE_ORIGIN);
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  });
  shape.closePath();

  const heightMeters = b.heightMeters || (b.levels ? b.levels * 3 : 6);
  const height = Math.max(0.3, heightMeters / CORE_METERS_PER_UNIT);

  let geometry;
  try {
    geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false });
  } catch {
    return; // a handful of OSM ways are self-intersecting/degenerate; skip those
  }
  geometry.rotateX(-Math.PI / 2);

  const color = b.historic ? 0x9c5b3f : b.name ? 0xd9c9a3 : 0xb9ac95;
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.75, wireframe: isWireframe });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    isLandmark: true,
    title: b.name || (b.historic ? `Historic building (${b.historic})` : "Building"),
    description: b.name
      ? `Real building footprint from OpenStreetMap${b.historic ? `, tagged historic: ${b.historic}` : ""}.`
      : "An unnamed real building footprint from OpenStreetMap.",
  };

  cityGroup.add(mesh);
  landmarkMeshes.push(mesh);
  osmBuildingMeshes.push(mesh);
}

function renderOsmBuildings() {
  clearOsmBuildingMeshes();
  if (!osmBuildingsData) return;
  for (const b of osmBuildingsData) addOsmBuildingMesh(b);
}

async function onFetchOsmClick() {
  fetchOsmBtn.disabled = true;
  osmStatusEl.textContent = "Loading real building footprints from OpenStreetMap…";
  try {
    osmBuildingsData = await fetchOsmBuildings(PUNE_ORIGIN);
    // Full rebuild (not just renderOsmBuildings) so the stylized fort
    // placeholder gets dropped now that real footprints cover that ground.
    buildPuneCity();
    const named = osmBuildingsData.filter((b) => b.name).length;
    osmStatusEl.textContent =
      `Loaded ${osmBuildingsData.length} real building footprints around Shaniwar Wada` +
      (named ? ` (${named} named, e.g. try clicking near the fort).` : ".");
  } catch (err) {
    osmStatusEl.textContent = `Couldn't load OpenStreetMap data: ${err.message}`;
  } finally {
    fetchOsmBtn.disabled = false;
  }
}

function buildDistrictCluster(district) {
  const profile = DISTRICT_PROFILES[district.profile];
  const half = profile.cellHalf;
  const { x: originX, z: originZ } = { x: district._x, z: district._z };

  const roadMat = new THREE.MeshStandardMaterial({ color: 0x24262b, roughness: 0.9 });
  const roadSize = (half * 2 + 1) * BLOCK_SPACING;
  for (let i = -half; i <= half; i++) {
    const lineX = new THREE.Mesh(new THREE.PlaneGeometry(roadSize, 0.7), roadMat);
    lineX.rotation.x = -Math.PI / 2;
    lineX.position.set(originX, 0.015, originZ + i * BLOCK_SPACING);
    lineX.receiveShadow = true;
    cityGroup.add(lineX);

    const lineZ = new THREE.Mesh(new THREE.PlaneGeometry(0.7, roadSize), roadMat);
    lineZ.rotation.x = -Math.PI / 2;
    lineZ.position.set(originX + i * BLOCK_SPACING, 0.015, originZ);
    lineZ.receiveShadow = true;
    cityGroup.add(lineZ);
  }

  for (let gx = -half; gx < half; gx++) {
    for (let gz = -half; gz < half; gz++) {
      if (Math.random() < 0.15) {
        if (profile.trees) addTree(originX + gx * BLOCK_SPACING + BLOCK_SPACING / 2, originZ + gz * BLOCK_SPACING + BLOCK_SPACING / 2);
        continue;
      }

      const floors = Math.floor(profile.minFloors + Math.random() * (profile.maxFloors - profile.minFloors));
      const height = Math.max(1, floors) * FLOOR_HEIGHT;
      const width = 1.6 + Math.random() * 1.1;
      const depth = 1.6 + Math.random() * 1.1;
      const color = profile.colors[Math.floor(Math.random() * profile.colors.length)];

      const geo = new THREE.BoxGeometry(width, height, depth);
      const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.1, wireframe: isWireframe });
      const mesh = new THREE.Mesh(geo, mat);

      const cx = originX + gx * BLOCK_SPACING + BLOCK_SPACING / 2 + (Math.random() - 0.5) * 0.5;
      const cz = originZ + gz * BLOCK_SPACING + BLOCK_SPACING / 2 + (Math.random() - 0.5) * 0.5;
      mesh.position.set(cx, height / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      mesh.userData = {
        isBuilding: true,
        title: `${district.name} Building`,
        height: height.toFixed(1),
        floors,
        footprint: `${width.toFixed(1)}m × ${depth.toFixed(1)}m`,
        district: district.name,
        description: district.description,
      };

      cityGroup.add(mesh);
      buildings.push(mesh);

      if (Math.random() < 0.5) addRooftopDetail(mesh, width, depth, height);
    }
  }
}

function addTree(x, z) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.08, 0.5, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 })
  );
  trunk.position.set(x, 0.25, z);
  trunk.castShadow = true;

  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.5, 8, 6),
    new THREE.MeshStandardMaterial({ color: 0x3f6b3a, roughness: 0.8 })
  );
  canopy.position.set(x, 0.8, z);
  canopy.castShadow = true;

  cityGroup.add(trunk, canopy);
}

function registerLandmarkMesh(mesh, landmark) {
  mesh.userData = { isLandmark: true, title: landmark.name, description: landmark.description };
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  cityGroup.add(mesh);
  landmarkMeshes.push(mesh);
}

function buildLandmark(landmark, x, z) {
  if (landmark.kind === "fort") {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x8b4a3a, roughness: 0.85 });
    const wallSize = 5;
    const wallHeight = 1.4;
    const positions = [
      [0, -wallSize / 2, wallSize, 0.4],
      [0, wallSize / 2, wallSize, 0.4],
      [-wallSize / 2, 0, 0.4, wallSize],
      [wallSize / 2, 0, 0.4, wallSize],
    ];
    for (const [dx, dz, w, d] of positions) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, wallHeight, d), wallMat);
      wall.position.set(x + dx, wallHeight / 2, z + dz);
      registerLandmarkMesh(wall, landmark);
    }
    const corners = [
      [-wallSize / 2, -wallSize / 2],
      [-wallSize / 2, wallSize / 2],
      [wallSize / 2, -wallSize / 2],
      [wallSize / 2, wallSize / 2],
    ];
    for (const [dx, dz] of corners) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 8), wallMat);
      tower.position.set(x + dx, 1.1, z + dz);
      registerLandmarkMesh(tower, landmark);
    }
  } else if (landmark.kind === "palace") {
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf0e6d2, roughness: 0.7 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 3), wallMat);
    body.position.set(x, 1.1, z);
    registerLandmarkMesh(body, landmark);

    const dome = new THREE.Mesh(new THREE.SphereGeometry(1.1, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), wallMat);
    dome.position.set(x, 2.2, z);
    registerLandmarkMesh(dome, landmark);
  } else if (landmark.kind === "hill") {
    const hillMat = new THREE.MeshStandardMaterial({ color: 0x5c6b3f, roughness: 1 });
    const hill = new THREE.Mesh(new THREE.ConeGeometry(4, 3, 16), hillMat);
    hill.position.set(x, 1.5, z);
    registerLandmarkMesh(hill, landmark);

    const templeMat = new THREE.MeshStandardMaterial({ color: 0xd9c9a3, roughness: 0.7 });
    const temple = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), templeMat);
    temple.position.set(x, 3.4, z);
    registerLandmarkMesh(temple, landmark);

    const spire = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 8), templeMat);
    spire.position.set(x, 4.3, z);
    registerLandmarkMesh(spire, landmark);
  } else if (landmark.kind === "campus") {
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0xcac2ab, roughness: 0.75 });
    const mainBuilding = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 1.8), stoneMat);
    mainBuilding.position.set(x, 0.8, z);
    registerLandmarkMesh(mainBuilding, landmark);

    for (let i = -2; i <= 2; i++) {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.6, 8), stoneMat);
      pillar.position.set(x + i * 0.9, 0.8, z + 1.1);
      registerLandmarkMesh(pillar, landmark);
    }

    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.2, 0.9), stoneMat);
    tower.position.set(x, 2.2, z);
    registerLandmarkMesh(tower, landmark);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.8, 4), stoneMat);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(x, 3.2, z);
    registerLandmarkMesh(roof, landmark);
  }
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
