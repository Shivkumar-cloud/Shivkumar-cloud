import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.getElementById("scene");
const loadingEl = document.getElementById("loading");
const infoEl = document.getElementById("info");
const citySizeInput = document.getElementById("citySize");
const citySizeValue = document.getElementById("citySizeValue");

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
let selected = null;
let isDay = true;
let isWireframe = false;
let sunLight, hemiLight, skyMesh;

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

  window.addEventListener("resize", onResize);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  document.getElementById("regenerate").addEventListener("click", () => buildCity(parseInt(citySizeInput.value, 10)));
  document.getElementById("toggle-day").addEventListener("click", toggleDayNight);
  document.getElementById("toggle-wireframe").addEventListener("click", toggleWireframe);
  document.getElementById("reset-camera").addEventListener("click", resetCamera);
  document.getElementById("info-close").addEventListener("click", () => selectBuilding(null));
  citySizeInput.addEventListener("input", () => {
    citySizeValue.textContent = citySizeInput.value;
  });
  citySizeInput.addEventListener("change", () => {
    const size = parseInt(citySizeInput.value, 10);
    buildCity(size);
    resetCamera();
  });

  onResize();
  requestAnimationFrame(animate);
  loadingEl.classList.add("hidden");
}

function setDefaultCameraPosition(gridSize = 12) {
  const radius = Math.max(30, gridSize * BLOCK_SPACING * 0.95);
  camera.position.set(radius, radius * 0.8, radius);
}

function resetCamera() {
  setDefaultCameraPosition(parseInt(citySizeInput.value, 10));
  controls.target.set(0, 4, 0);
  controls.update();
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

function buildCity(gridSize) {
  if (cityGroup) {
    scene.remove(cityGroup);
    disposeGroup(cityGroup);
  }
  buildings = [];
  selectBuilding(null);

  cityGroup = new THREE.Group();
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
  const intersects = raycaster.intersectObjects(buildings, false);

  if (intersects.length > 0) {
    selectBuilding(intersects[0].object);
  } else {
    selectBuilding(null);
  }
}

function selectBuilding(mesh) {
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

  document.getElementById("info-title").textContent = `${mesh.userData.district} Building`;
  document.getElementById("info-height").textContent = `${mesh.userData.height} m`;
  document.getElementById("info-floors").textContent = mesh.userData.floors;
  document.getElementById("info-footprint").textContent = mesh.userData.footprint;
  document.getElementById("info-district").textContent = mesh.userData.district;
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
