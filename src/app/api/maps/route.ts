import { NextResponse } from "next/server";
import { validCoords, distanceKm } from "@/lib/delivery";

const GOOGLE_KEY =
  process.env.GOOGLE_MAPS_API_KEY ||
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ||
  "";

// Decode Google Encoded Polyline into [lat, lng][]
function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let b: number;
    let shift = 0;
    let result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

// Snap a point [lat, lng] to the nearest segment on a polyline and return remaining sliced path
function snapAndSliceRoute(
  coords: [number, number][],
  rider: [number, number]
): { snapped: [number, number]; remaining: [number, number][]; bearing: number } {
  if (coords.length < 2) {
    return { snapped: rider, remaining: coords, bearing: 0 };
  }
  let bestIdx = 0;
  let bestDist = Infinity;
  let bestPoint: [number, number] = coords[0];

  for (let i = 0; i < coords.length - 1; i++) {
    const [ay, ax] = coords[i];
    const [by, bx] = coords[i + 1];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((rider[1] - ax) * dx + (rider[0] - ay) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const projLat = ay + t * dy;
    const projLng = ax + t * dx;
    const d = (rider[0] - projLat) ** 2 + (rider[1] - projLng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      bestPoint = [projLat, projLng];
    }
  }

  const nextPt = coords[Math.min(bestIdx + 1, coords.length - 1)];
  const dLon = ((nextPt[1] - bestPoint[1]) * Math.PI) / 180;
  const lat1 = (bestPoint[0] * Math.PI) / 180;
  const lat2 = (nextPt[0] * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;

  return {
    snapped: bestPoint,
    remaining: [bestPoint, ...coords.slice(bestIdx + 1)],
    bearing,
  };
}

const AMBIKAPUR_LANDMARKS: Array<{ name: string; area: string; lat: number; lng: number }> = [
  { name: "Mahamaya Chowk", area: "Deviganj Rd & Mahamaya Rd", lat: 23.12265, lng: 83.19815 },
  { name: "Sangam Chowk", area: "Deviganj Rd & Bramha Path", lat: 23.12275, lng: 83.19675 },
  { name: "Ghadi Chowk (Clock Tower)", area: "Central Ambikapur", lat: 23.12575, lng: 83.19325 },
  { name: "Gandhi Chowk", area: "Collectorate Road, Ambikapur", lat: 23.12710, lng: 83.19120 },
  { name: "Mayapur Chowk", area: "Mayapur, Ambikapur", lat: 23.12380, lng: 83.20120 },
  { name: "Gudri Market", area: "Vegetable Market Rd, Ambikapur", lat: 23.12460, lng: 83.19900 },
  { name: "Imlipara", area: "Near Sadar Road, Ambikapur", lat: 23.12110, lng: 83.19680 },
  { name: "Sadar Road", area: "Mahamaya Chowk, Ambikapur", lat: 23.12020, lng: 83.19770 },
  { name: "Bramha Road", area: "Bramha Path, Ambikapur", lat: 23.12050, lng: 83.19520 },
  { name: "Sattipara", area: "Sattipara Rd, Ambikapur", lat: 23.11820, lng: 83.19550 },
  { name: "Rasulpur", area: "Sadar Rd South, Ambikapur", lat: 23.11820, lng: 83.19920 },
  { name: "Barejpara", area: "Ambikapur", lat: 23.11620, lng: 83.19800 },
  { name: "Mominpura", area: "Mominpura Rd, Ambikapur", lat: 23.12100, lng: 83.20220 },
  { name: "Mayapur", area: "Mayapur, Ambikapur", lat: 23.12450, lng: 83.20320 },
  { name: "Mahamaya Road", area: "Near Mahamaya Chowk, Ambikapur", lat: 23.12020, lng: 83.20080 },
  { name: "Deviganj Road", area: "Central Ambikapur", lat: 23.12380, lng: 83.19520 },
  { name: "Bilaspur Chowk", area: "Ring Road South-West, Ambikapur", lat: 23.09875, lng: 83.18685 },
  { name: "Ambedkar Chowk", area: "Manendragarh Road, Ambikapur", lat: 23.12680, lng: 83.18690 },
  { name: "Kharsiya Chowk", area: "Ring Road East, Ambikapur", lat: 23.11280, lng: 83.20550 },
  { name: "Pratiksha Bus Stand", area: "Bus Stand Road, Ambikapur", lat: 23.11650, lng: 83.20280 },
  { name: "Kedarpur", area: "Kedarpur, Ambikapur", lat: 23.12920, lng: 83.19580 },
  { name: "Chopra Para", area: "Chopra Colony, Ambikapur", lat: 23.12480, lng: 83.18950 },
  { name: "Banaras Chowk", area: "Banaras Road, Ambikapur", lat: 23.13250, lng: 83.19180 },
  { name: "Subhash Nagar", area: "Ambikapur", lat: 23.13420, lng: 83.19750 },
  { name: "Transport Nagar", area: "Ring Road, Ambikapur", lat: 23.11120, lng: 83.20680 },
  { name: "Mahamaya Temple Area", area: "Mahamaya Hill, Ambikapur", lat: 23.11450, lng: 83.20850 },
];

function findNearestLandmark(lat: number, lng: number): { name: string; area: string; meters: number } {
  let best = AMBIKAPUR_LANDMARKS[0];
  let bestMeters = Infinity;
  for (const lm of AMBIKAPUR_LANDMARKS) {
    const m = distanceKm({ lat, lng }, { lat: lm.lat, lng: lm.lng }) * 1000;
    if (m < bestMeters) {
      bestMeters = m;
      best = lm;
    }
  }
  return { name: best.name, area: best.area, meters: bestMeters };
}

function sanitizeEnglishAddress(raw: string, lat: number, lng: number): string {
  const cleanedParts = raw
    .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, "")
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p.length > 1 && !/^ambikapur(\s+tahsil)?$/i.test(p));

  const nearest = findNearestLandmark(lat, lng);
  if (cleanedParts.length === 0) {
    return `${nearest.name}, ${nearest.area}, Ambikapur, Chhattisgarh 497001`;
  }
  if (/^(surguja|chhattisgarh|india|police line area|bangali chawk|\d{6})$/i.test(cleanedParts[0])) {
    return `${nearest.name}, ${nearest.area}, Ambikapur, Chhattisgarh 497001`;
  }
  if (nearest.meters <= 130 && !cleanedParts[0].toLowerCase().includes(nearest.name.toLowerCase())) {
    return `${nearest.name}, ${cleanedParts[0]}, Ambikapur, Chhattisgarh 497001`;
  }
  return `${cleanedParts[0]}, ${nearest.name}, Ambikapur, Chhattisgarh 497001`;
}

// In-memory route & geocode cache to save Google API quota
const routeCache = new Map<string, { data: any; ts: number }>();
const geocodeCache = new Map<string, { address: string; ts: number }>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "route";

  // 1. Reverse Geocoding (Lat/Lng -> Accurate Ambikapur Chowk / Street / POI in English)
  if (action === "geocode") {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (!validCoords(lat, lng)) {
      return NextResponse.json({ success: false, error: "Invalid coordinates" }, { status: 400 });
    }
    const cacheKey = `v3:${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
      return NextResponse.json({ success: true, address: cached.address, provider: "cache" });
    }

    const nearest = findNearestLandmark(lat, lng);

    // A) Try Google Geocoding API if key has Geocoding enabled
    if (GOOGLE_KEY) {
      try {
        const gRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=en&key=${GOOGLE_KEY}`,
          { signal: AbortSignal.timeout(3500) }
        );
        const gData = await gRes.json();
        if (gData.status === "OK" && gData.results?.[0]?.formatted_address) {
          const addr = sanitizeEnglishAddress(gData.results[0].formatted_address, lat, lng);
          geocodeCache.set(cacheKey, { address: addr, ts: Date.now() });
          return NextResponse.json({ success: true, address: addr, provider: "google" });
        }
      } catch {}
    }

    // B) Try ArcGIS World Reverse Geocoder (street & POI level accuracy in Ambikapur)
    try {
      const aRes = await fetch(
        `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?f=pjson&location=${lng},${lat}&langCode=EN&featureTypes=POI,StreetAddress,StreetName,PointAddress`,
        { signal: AbortSignal.timeout(4000) }
      );
      const aData = await aRes.json();
      const aAddr = aData?.address;
      if (aAddr) {
        const poi = (aAddr.PlaceName || "").trim();
        const street = (aAddr.Address || "").trim();
        let finalAddr = "";
        if (nearest.meters <= 110) {
          // Pin is right at a known Ambikapur Chowk/Mohalla
          const detail = street || poi || nearest.area;
          finalAddr = `${nearest.name}, ${detail}, Ambikapur, Chhattisgarh 497001`;
        } else if (poi && street && poi.toLowerCase() !== street.toLowerCase()) {
          finalAddr = `${poi}, ${street}, Near ${nearest.name}, Ambikapur 497001`;
        } else if (street) {
          finalAddr = `${street}, Near ${nearest.name}, Ambikapur, Chhattisgarh 497001`;
        } else if (poi && !/^ambikapur$/i.test(poi)) {
          finalAddr = `${poi}, Near ${nearest.name}, Ambikapur, Chhattisgarh 497001`;
        }
        if (finalAddr) {
          geocodeCache.set(cacheKey, { address: finalAddr, ts: Date.now() });
          return NextResponse.json({ success: true, address: finalAddr, provider: "arcgis" });
        }
      }
    } catch {}

    // C) Fallback to Nominatim + Nearest Ambikapur Landmark
    try {
      const nRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=en`,
        {
          headers: {
            "User-Agent": "ZuppoAmbikapurDelivery/1.0",
            "Accept-Language": "en-IN,en;q=0.9",
          },
          signal: AbortSignal.timeout(4000),
        }
      );
      const nData = await nRes.json();
      if (nData?.display_name) {
        const addrObj = nData.address || {};
        const specificPart =
          addrObj.road ||
          addrObj.neighbourhood ||
          addrObj.suburb ||
          addrObj.amenity ||
          addrObj.shop ||
          "";
        const combined = specificPart ? `${specificPart}, ${nData.display_name}` : nData.display_name;
        const cleanAddr = sanitizeEnglishAddress(combined, lat, lng);
        geocodeCache.set(cacheKey, { address: cleanAddr, ts: Date.now() });
        return NextResponse.json({ success: true, address: cleanAddr, provider: "osm" });
      }
    } catch {}

    const fallbackAddr = `${nearest.name}, ${nearest.area}, Ambikapur, Chhattisgarh 497001`;
    return NextResponse.json({
      success: true,
      address: fallbackAddr,
      provider: "fallback",
    });
  }

  // 2. Road Route + Polyline + Traffic ETA (Google Routes API v2 -> Google Directions -> OSRM)
  const fromLat = Number(searchParams.get("fromLat"));
  const fromLng = Number(searchParams.get("fromLng"));
  const toLat = Number(searchParams.get("toLat"));
  const toLng = Number(searchParams.get("toLng"));

  if (!validCoords(fromLat, fromLng) || !validCoords(toLat, toLng)) {
    return NextResponse.json({ success: false, error: "Invalid route coordinates" }, { status: 400 });
  }

  const cacheKey = `${fromLat.toFixed(4)},${fromLng.toFixed(4)}->${toLat.toFixed(4)},${toLng.toFixed(4)}`;
  const cached = routeCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 60 * 1000) {
    const snappedInfo = snapAndSliceRoute(cached.data.coordinates, [fromLat, fromLng]);
    return NextResponse.json({
      ...cached.data,
      coordinates: snappedInfo.remaining,
      snappedOrigin: snappedInfo.snapped,
      bearing: snappedInfo.bearing,
    });
  }

  // Try 1: Google Routes API v2
  if (GOOGLE_KEY) {
    try {
      const rRes = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_KEY,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: fromLat, longitude: fromLng } } },
          destination: { location: { latLng: { latitude: toLat, longitude: toLng } } },
          travelMode: "DRIVE",
          routingPreference: "TRAFFIC_AWARE",
        }),
        signal: AbortSignal.timeout(5000),
      });
      const rData = await rRes.json();
      const route = rData?.routes?.[0];
      if (route?.polyline?.encodedPolyline) {
        const coords = decodePolyline(route.polyline.encodedPolyline);
        const seconds = Number(String(route.duration || "300s").replace("s", "")) || 300;
        const km = Number(((route.distanceMeters || 1500) / 1000).toFixed(1));
        const minutes = Math.max(2, Math.round(seconds / 60));
        const snappedInfo = snapAndSliceRoute(coords, [fromLat, fromLng]);
        const payload = {
          success: true,
          provider: "google_routes",
          distanceKm: km,
          durationMinutes: minutes,
          coordinates: coords,
          snappedOrigin: snappedInfo.snapped,
          bearing: snappedInfo.bearing,
        };
        routeCache.set(cacheKey, { data: payload, ts: Date.now() });
        return NextResponse.json(payload);
      }
    } catch {}
  }

  // Try 2: OSRM Road Routing
  try {
    const oRes = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(5000) }
    );
    const oData = await oRes.json();
    const oRoute = oData?.routes?.[0];
    if (oRoute?.geometry?.coordinates?.length) {
      const coords: [number, number][] = oRoute.geometry.coordinates.map((p: number[]) => [
        p[1],
        p[0],
      ]);
      const km = Number((oRoute.distance / 1000).toFixed(1));
      const minutes = Math.max(2, Math.round(oRoute.duration / 60));
      const snappedInfo = snapAndSliceRoute(coords, [fromLat, fromLng]);
      const payload = {
        success: true,
        provider: "osrm",
        distanceKm: km,
        durationMinutes: minutes,
        coordinates: coords,
        snappedOrigin: snappedInfo.snapped,
        bearing: snappedInfo.bearing,
      };
      routeCache.set(cacheKey, { data: payload, ts: Date.now() });
      return NextResponse.json(payload);
    }
  } catch {}

  // Try 3: Direct Fallback
  const directKm = Math.max(0.3, distanceKm({ lat: fromLat, lng: fromLng }, { lat: toLat, lng: toLng }) * 1.25);
  return NextResponse.json({
    success: true,
    provider: "direct",
    distanceKm: Number(directKm.toFixed(1)),
    durationMinutes: Math.max(3, Math.round(directKm / 0.35)),
    coordinates: [
      [fromLat, fromLng],
      [toLat, toLng],
    ],
    snappedOrigin: [fromLat, fromLng],
    bearing: 0,
  });
}
