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

// In-memory route & geocode cache to save Google API quota
const routeCache = new Map<string, { data: any; ts: number }>();
const geocodeCache = new Map<string, { address: string; ts: number }>();

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "route";

  // 1. Reverse Geocoding (Lat/Lng -> Ambikapur Address)
  if (action === "geocode") {
    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    if (!validCoords(lat, lng)) {
      return NextResponse.json({ success: false, error: "Invalid coordinates" }, { status: 400 });
    }
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const cached = geocodeCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
      return NextResponse.json({ success: true, address: cached.address, provider: "cache" });
    }

    if (GOOGLE_KEY) {
      try {
        const gRes = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`,
          { signal: AbortSignal.timeout(5000) }
        );
        const gData = await gRes.json();
        if (gData.status === "OK" && gData.results?.[0]?.formatted_address) {
          const addr = gData.results[0].formatted_address;
          geocodeCache.set(cacheKey, { address: addr, ts: Date.now() });
          return NextResponse.json({ success: true, address: addr, provider: "google" });
        }
      } catch {}
    }

    // Fallback to Nominatim if Google key is still activating
    try {
      const nRes = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: { "User-Agent": "ZuppoAmbikapurDelivery/1.0" },
          signal: AbortSignal.timeout(5000),
        }
      );
      const nData = await nRes.json();
      if (nData?.display_name) {
        geocodeCache.set(cacheKey, { address: nData.display_name, ts: Date.now() });
        return NextResponse.json({ success: true, address: nData.display_name, provider: "osm" });
      }
    } catch {}

    return NextResponse.json({
      success: true,
      address: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Ambikapur`,
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
