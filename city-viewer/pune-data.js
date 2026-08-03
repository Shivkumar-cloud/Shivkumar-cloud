// Real-world reference coordinates for Pune, India (approximate, WGS84).
// Used to place districts/landmarks at geographically correct relative
// bearings and distances from Shaniwar Wada (the historic city center).
export const PUNE_ORIGIN = { lat: 18.5195, lng: 73.8553 }; // Shaniwar Wada

// 1 scene unit = 220 real-world meters. Keeps the whole metro area
// (~15km across) framed similarly to the largest procedural city,
// while preserving true relative bearings and proportional distances.
export const METERS_PER_UNIT = 220;

const METERS_PER_DEG_LAT = 111320;

export function projectLatLng(lat, lng, origin = PUNE_ORIGIN) {
  const metersPerDegLng = METERS_PER_DEG_LAT * Math.cos((origin.lat * Math.PI) / 180);
  const xMeters = (lng - origin.lng) * metersPerDegLng;
  const zMeters = -(lat - origin.lat) * METERS_PER_DEG_LAT;
  return {
    x: xMeters / METERS_PER_UNIT,
    z: zMeters / METERS_PER_UNIT,
  };
}

export const DISTRICT_PROFILES = {
  residential: { colors: [0xb0785a, 0xc9946b, 0xa8683f, 0xd9a878], minFloors: 3, maxFloors: 9, cellHalf: 2 },
  leafy: { colors: [0xd8c9a3, 0xc7b892, 0xefe3c0, 0xcdbd93], minFloors: 2, maxFloors: 5, cellHalf: 2, trees: true },
  itpark: { colors: [0x2f6f6b, 0x3d8b86, 0x4fa8a1, 0x2b4d6b], minFloors: 10, maxFloors: 28, cellHalf: 3 },
  business: { colors: [0x3a4a63, 0x54688a, 0x45608a, 0x374861], minFloors: 6, maxFloors: 16, cellHalf: 2 },
  oldcity: { colors: [0x8a6b52, 0x9c7a5e, 0x6d5643, 0xb08d68], minFloors: 1, maxFloors: 4, cellHalf: 2 },
};

// Landmarks: distinct stylized models, informational only (no procedural buildings).
export const PUNE_LANDMARKS = [
  {
    id: "shaniwarwada",
    name: "Shaniwar Wada",
    kind: "fort",
    lat: 18.5195,
    lng: 73.8553,
    description:
      "Built in 1732, this fortified palace complex was the seat of the Peshwa rulers of the Maratha Empire.",
  },
  {
    id: "agakhan",
    name: "Aga Khan Palace",
    kind: "palace",
    lat: 18.5516,
    lng: 73.9007,
    description:
      "Built in 1892 by Sultan Muhammad Shah Aga Khan III. Mahatma Gandhi was detained here in 1942-44; it now houses a memorial to Kasturba Gandhi.",
  },
  {
    id: "parvati",
    name: "Parvati Hill",
    kind: "hill",
    lat: 18.4959,
    lng: 73.8567,
    description:
      "A hillock crowned by the Parvati Temple complex, built by the Peshwas in the 1700s, offering panoramic views across the city.",
  },
  {
    id: "puneuni",
    name: "Savitribai Phule Pune University",
    kind: "campus",
    lat: 18.5529,
    lng: 73.8228,
    description:
      "Founded in 1949; its Main Building dates to 1864 and was originally the Government House.",
  },
];

// Districts: real neighborhoods, each rendered as a procedural building
// cluster whose density/height/palette reflects that area's real character.
export const PUNE_DISTRICTS = [
  {
    id: "kothrud",
    name: "Kothrud",
    profile: "residential",
    lat: 18.5074,
    lng: 73.8077,
    description: "A large southwestern residential suburb of mid-rise apartment blocks.",
  },
  {
    id: "koregaonpark",
    name: "Koregaon Park",
    profile: "leafy",
    lat: 18.5362,
    lng: 73.8937,
    description:
      "Pune's upscale, tree-lined nightlife and hospitality district, home to the Osho International Meditation Resort.",
  },
  {
    id: "hinjewadi",
    name: "Hinjewadi IT Park",
    profile: "itpark",
    lat: 18.5908,
    lng: 73.7397,
    description:
      "Pune's largest IT hub (Rajiv Gandhi Infotech Park), home to major tech campuses since the early 2000s.",
  },
  {
    id: "kharadi",
    name: "Kharadi",
    profile: "itpark",
    lat: 18.5515,
    lng: 73.943,
    description: "A fast-growing eastern IT corridor with large SEZ office campuses.",
  },
  {
    id: "vimannagar",
    name: "Viman Nagar",
    profile: "business",
    lat: 18.5679,
    lng: 73.9143,
    description: "A modern mixed residential and commercial district near Pune International Airport.",
  },
  {
    id: "swargate",
    name: "Swargate",
    profile: "oldcity",
    lat: 18.5008,
    lng: 73.8567,
    description: "A dense, low-rise commercial market district and major bus transit hub next to the historic core.",
  },
  {
    id: "camp",
    name: "Pune Camp",
    profile: "oldcity",
    lat: 18.5122,
    lng: 73.8797,
    description:
      "A cantonment area established by the British in 1817; now commercial streets and colonial-era buildings along M.G. Road.",
  },
  {
    id: "aundh",
    name: "Aundh",
    profile: "residential",
    lat: 18.559,
    lng: 73.8077,
    description: "A rapidly urbanizing northwestern suburb of apartment complexes and malls.",
  },
  {
    id: "baner",
    name: "Baner",
    profile: "business",
    lat: 18.559,
    lng: 73.7868,
    description: "A northwestern suburb mixing IT offices with new residential high-rises.",
  },
  {
    id: "deccan",
    name: "Deccan Gymkhana",
    profile: "oldcity",
    lat: 18.5195,
    lng: 73.8402,
    description: "A century-old sporting and cultural institution area, historically home to Pune's intellectual elite.",
  },
];
