"use client";

import { distanceKm } from "@/lib/delivery";

export type LatLngTuple = [number, number];

let googleMapsPromise: Promise<any> | null = null;
let cachedApiKey: string = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export async function loadGoogleMapsSdk(): Promise<any> {
  if (typeof window === "undefined") return null;
  const w = window as any;
  if (w.google?.maps?.DirectionsService && w.google?.maps?.Geocoder) {
    return w.google.maps;
  }
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = (async () => {
    try {
      if (!cachedApiKey) {
        const res = await fetch("/api/maps?action=key");
        const data = await res.json();
        cachedApiKey = data?.key || "";
      }
      if (!cachedApiKey) return null;

      await new Promise<void>((resolve, reject) => {
        const existing = document.getElementById("zuppo-google-maps-sdk") as HTMLScriptElement | null;
        if (existing) {
          if ((window as any).google?.maps) {
            resolve();
            return;
          }
          existing.addEventListener("load", () => resolve());
          existing.addEventListener("error", () => reject(new Error("Google Maps SDK load failed")));
          return;
        }
        const script = document.createElement("script");
        script.id = "zuppo-google-maps-sdk";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
          cachedApiKey
        )}&libraries=places,geometry&language=en&region=IN`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("Google Maps SDK load failed"));
        document.head.appendChild(script);
      });

      return (window as any).google?.maps || null;
    } catch {
      googleMapsPromise = null;
      return null;
    }
  })();

  return googleMapsPromise;
}

export async function browserReverseGeocode(
  lat: number,
  lng: number
): Promise<{ placeTitle: string; fullAddress: string }> {
  // 1. Try Official Google Maps JS Geocoder first (uses Maps JavaScript API)
  try {
    const gmaps = await loadGoogleMapsSdk();
    if (gmaps?.Geocoder) {
      const geocoder = new gmaps.Geocoder();
      const response = await geocoder.geocode({ location: { lat, lng } });
      const results: any[] = response?.results || [];
      if (results.length > 0) {
        // Pick the most specific non-PlusCode result
        const best =
          results.find(
            (r) =>
              !r.types?.includes("plus_code") &&
              !/^[A-Z0-9]{4}\+[A-Z0-9]{2,}/.test(r.formatted_address || "")
          ) || results[0];

        const rawFormatted: string = (best.formatted_address || "")
          .replace(/^[A-Z0-9]{4}\+[A-Z0-9]{2,}\s*,?\s*/i, "")
          .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, "")
          .trim();

        const comps: any[] = best.address_components || [];
        const findComp = (types: string[]) =>
          comps.find((c) => types.some((t) => c.types?.includes(t)))?.long_name || "";

        const poi =
          findComp(["point_of_interest", "establishment", "premise", "sublocality_level_2", "sublocality_level_1", "neighborhood"]) ||
          findComp(["route"]);
        const firstPart = rawFormatted.split(",")[0]?.trim() || "";
        const placeTitle =
          poi && !/^[A-Z0-9]{4}\+/.test(poi) && !/^ambikapur$/i.test(poi)
            ? poi
            : firstPart && !/^ambikapur$/i.test(firstPart)
            ? firstPart
            : "Ambikapur";

        if (rawFormatted) {
          return {
            placeTitle,
            fullAddress: rawFormatted,
          };
        }
      }
    }
  } catch {}

  // 2. Fallback to server-side /api/maps?action=geocode (ArcGIS + Calibrated Ambikapur Chowks)
  try {
    const res = await fetch(`/api/maps?action=geocode&lat=${lat}&lng=${lng}`);
    const data = await res.json();
    if (data?.success && data.address) {
      const clean = String(data.address)
        .replace(/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]+/g, "")
        .replace(/^,\s*/, "")
        .trim();
      const first = clean.split(",")[0]?.trim() || "Ambikapur";
      return { placeTitle: first, fullAddress: clean };
    }
  } catch {}

  return {
    placeTitle: "Ambikapur",
    fullAddress: `Pinned Location (${lat.toFixed(4)}, ${lng.toFixed(4)}), Ambikapur`,
  };
}

export function computeBearingDegrees(from: LatLngTuple, to: LatLngTuple): number {
  const dLon = ((to[1] - from[1]) * Math.PI) / 180;
  const lat1 = (from[0] * Math.PI) / 180;
  const lat2 = (to[0] * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function snapRiderAlongPolyline(
  coords: LatLngTuple[],
  rider: LatLngTuple
): {
  snapped: LatLngTuple;
  traveled: LatLngTuple[];
  remaining: LatLngTuple[];
  bearing: number;
} {
  if (coords.length < 2) {
    return {
      snapped: rider,
      traveled: [rider],
      remaining: coords.length ? [rider, ...coords] : [rider],
      bearing: 0,
    };
  }
  let bestIdx = 0;
  let bestDistSq = Infinity;
  let bestPoint: LatLngTuple = coords[0];

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
    const dSq = (rider[0] - projLat) ** 2 + (rider[1] - projLng) ** 2;
    if (dSq < bestDistSq) {
      bestDistSq = dSq;
      bestIdx = i;
      bestPoint = [projLat, projLng];
    }
  }

  // Only snap onto road if rider is within ~90 meters of the route; otherwise keep rider's true road position
  const distMeters = distanceKm(
    { lat: rider[0], lng: rider[1] },
    { lat: bestPoint[0], lng: bestPoint[1] }
  ) * 1000;
  const effectiveRider: LatLngTuple = distMeters <= 95 ? bestPoint : rider;

  const nextPt = coords[Math.min(bestIdx + 1, coords.length - 1)];
  const bearing = computeBearingDegrees(effectiveRider, nextPt);

  return {
    snapped: effectiveRider,
    traveled: [...coords.slice(0, bestIdx + 1), effectiveRider],
    remaining: [effectiveRider, ...coords.slice(bestIdx + 1)],
    bearing,
  };
}

export async function browserGetRoadRoute(
  from: LatLngTuple,
  to: LatLngTuple,
  rider: LatLngTuple | null
): Promise<{
  fullCoords: LatLngTuple[];
  traveledCoords: LatLngTuple[];
  remainingCoords: LatLngTuple[];
  snappedRider: LatLngTuple | null;
  bearing: number;
  distanceKm: string;
  durationMinutes: number;
  roadSummary: string;
}> {
  let fullCoords: LatLngTuple[] = [];
  let distKmStr = "";
  let durMins = 0;
  let roadSummary = "";

  // 1. Try Official Google Maps JS DirectionsService first
  try {
    const gmaps = await loadGoogleMapsSdk();
    if (gmaps?.DirectionsService) {
      const ds = new gmaps.DirectionsService();
      const result = await ds.route({
        origin: { lat: from[0], lng: from[1] },
        destination: { lat: to[0], lng: to[1] },
        travelMode: gmaps.TravelMode.DRIVING,
      });
      const route = result?.routes?.[0];
      const leg = route?.legs?.[0];
      if (route?.overview_path?.length) {
        // Extract detailed step path for high-precision road snapping
        const detailed: LatLngTuple[] = [];
        for (const step of leg?.steps || []) {
          for (const pt of step.path || []) {
            detailed.push([pt.lat(), pt.lng()]);
          }
        }
        fullCoords =
          detailed.length >= 2
            ? detailed
            : route.overview_path.map((p: any) => [p.lat(), p.lng()] as LatLngTuple);

        const meters = leg?.distance?.value || 1200;
        const secs = leg?.duration?.value || 360;
        distKmStr = Math.max(0.2, meters / 1000).toFixed(1);
        durMins = Math.max(2, Math.round(secs / 60));
        roadSummary = route.summary || "";
      }
    }
  } catch {}

  // 2. Fallback to /api/maps?action=route (OSRM / Server Route)
  if (fullCoords.length < 2) {
    try {
      const r = await fetch(
        `/api/maps?action=route&fromLat=${from[0]}&fromLng=${from[1]}&toLat=${to[0]}&toLng=${to[1]}`
      );
      const d = await r.json();
      if (d?.success && Array.isArray(d.coordinates) && d.coordinates.length >= 2) {
        fullCoords = d.coordinates;
        distKmStr = String(d.distanceKm);
        durMins = Number(d.durationMinutes);
      }
    } catch {}
  }

  if (fullCoords.length < 2) {
    fullCoords = [from, to];
    const straight = distanceKm({ lat: from[0], lng: from[1] }, { lat: to[0], lng: to[1] });
    distKmStr = Math.max(0.3, straight * 1.25).toFixed(1);
    durMins = Math.max(3, Math.round((straight * 1.25) / 0.35));
  }

  if (rider) {
    const snappedInfo = snapRiderAlongPolyline(fullCoords, rider);
    const remKm = distanceKm(
      { lat: snappedInfo.snapped[0], lng: snappedInfo.snapped[1] },
      { lat: to[0], lng: to[1] }
    );
    const remDistStr = Math.max(0.1, remKm * 1.2).toFixed(1);
    const remMins = Math.max(1, Math.round((remKm * 1.2) / 0.38));
    return {
      fullCoords,
      traveledCoords: snappedInfo.traveled,
      remainingCoords: snappedInfo.remaining,
      snappedRider: snappedInfo.snapped,
      bearing: snappedInfo.bearing,
      distanceKm: remDistStr,
      durationMinutes: remMins,
      roadSummary,
    };
  }

  return {
    fullCoords,
    traveledCoords: [],
    remainingCoords: fullCoords,
    snappedRider: null,
    bearing: computeBearingDegrees(from, to),
    distanceKm: distKmStr,
    durationMinutes: durMins,
    roadSummary,
  };
}
