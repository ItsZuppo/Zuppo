"use client";

import React, { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import {
  Maximize2,
  Minimize2,
  X,
  Plus,
  Minus,
  Navigation,
  Store,
  MapPin,
  ExternalLink,
} from "lucide-react";

interface DeliveryMapProps {
  restaurantName?: string;
  customerArea?: string;
  orderNumber?: string;
  mode?: "customer" | "rider";
  height?: string;
  riderLat?: number;
  riderLng?: number;
  riderLocationUpdatedAt?: string;
  customerLat?: number;
  customerLng?: number;
}

// Landmark Coordinates in Ambikapur
const AMBIKAPUR_LANDMARKS: Record<string, [number, number]> = {
  "gandhi chowk": [23.12341, 83.19330],
  "ghadi chowk": [23.12295, 83.19799],
  "clock tower": [23.12295, 83.19799],
  "ring road": [23.11801, 83.20313],
  "transport nagar": [23.11801, 83.20313],
  "kedarpur": [23.11559, 83.20455],
  "hospital": [23.12091, 83.20262],
  "sadhar hospital": [23.12091, 83.20262],
  "mahamaya": [23.13150, 83.18920],
  "royal kitchen": [23.12341, 83.19330],
  "burger hub": [23.12295, 83.19799],
  "dosa plaza": [23.11559, 83.20455],
  "kathi rolls": [23.11801, 83.20313],
};

function resolveCoords(queryStr: string, defaultCoord: [number, number]): [number, number] {
  const clean = queryStr.toLowerCase();
  for (const [key, coord] of Object.entries(AMBIKAPUR_LANDMARKS)) {
    if (clean.includes(key)) return coord;
  }
  return defaultCoord;
}

export default function AmbikapurDeliveryMap({
  restaurantName = "The Royal Kitchen",
  customerArea = "Kedarpur Residential Zone, Ambikapur",
  orderNumber = "#ZB-LIVE",
  mode = "customer",
  height = "280px",
  riderLat,
  riderLng,
  riderLocationUpdatedAt,
  customerLat,
  customerLng,
}: DeliveryMapProps) {
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const bikeMarkerRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [etaMinutes, setEtaMinutes] = useState(12);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [routeAvailable, setRouteAvailable] = useState(false);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer); }, []);

  // Dynamically resolve actual Ambikapur Restaurant & Customer drop coordinates
  const restaurantCoord: [number, number] = resolveCoords(restaurantName, [23.12341, 83.1933]);
  const customerCoord: [number, number] = customerLat && customerLng
    ? [customerLat, customerLng]
    : resolveCoords(customerArea, [23.11559, 83.20455]);

  // Compute road route points passing through live GPS if available
  const buildRoutePoints = (currentRiderLat?: number, currentRiderLng?: number): [number, number][] => {
    if (currentRiderLat && currentRiderLng) {
      return [
        restaurantCoord,
        [currentRiderLat, currentRiderLng],
        customerCoord,
      ];
    }
    const midLat = (restaurantCoord[0] + customerCoord[0]) / 2;
    const midLng = (restaurantCoord[1] + customerCoord[1]) / 2;
    return [
      restaurantCoord,
      [restaurantCoord[0] + (midLat - restaurantCoord[0]) * 0.4, restaurantCoord[1] + (midLng - restaurantCoord[1]) * 0.2],
      [midLat, midLng],
      [customerCoord[0] - (customerCoord[0] - midLat) * 0.3, customerCoord[1] - (customerCoord[1] - midLng) * 0.4],
      customerCoord,
    ];
  };

  useEffect(() => {
    let isMounted = true;

    // Dynamically initialize Leaflet on the client
    const initLeaflet = async () => {
      if (!mapContainerRef.current || mapInstanceRef.current) return;

      try {
        const L = (await import("leaflet")).default;

        if (!isMounted || !mapContainerRef.current) return;

        // Clean any leftover leaflet DOM before initializing
        if ((mapContainerRef.current as any)._leaflet_id) {
          (mapContainerRef.current as any)._leaflet_id = null;
        }

        const map = L.map(mapContainerRef.current, {
          center: [23.1200, 83.1985],
          zoom: 15,
          zoomControl: false,
          attributionControl: true,
          zoomAnimation: true,
          fadeAnimation: true,
          markerZoomAnimation: true,
          scrollWheelZoom: false,
        });

        // Public OSM tiles: attribution and usage policy apply; no guaranteed availability
        L.tileLayer(
          "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          }
        ).addTo(map);

        // Marker 1: Restaurant Pin (Gandhi Chowk)
        const restIcon = L.divIcon({
          className: "leaflet-custom-div",
          html: `<div style="background-color:#ea580c; width:34px; height:34px; border-radius:50%; border:3px solid white; box-shadow:0 6px 16px rgba(234,88,12,0.4); display:flex; align-items:center; justify-content:center; font-size:16px;">🏪</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
        });

        // Marker 2: Customer House Pin (Drop location)
        const customerIcon = L.divIcon({
          className: "leaflet-custom-div",
          html: `<div style="background-color:#16a34a; width:34px; height:34px; border-radius:50%; border:3px solid white; box-shadow:0 6px 16px rgba(22,163,74,0.4); display:flex; align-items:center; justify-content:center; font-size:16px;">🏠</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
        });

        // Marker 3: Rider Bike Pin
        const bikeIcon = L.divIcon({
          className: "leaflet-custom-div",
          html: `<div style="background-color:#0f172a; width:38px; height:38px; border-radius:50%; border:3px solid #f97316; box-shadow:0 8px 24px rgba(0,0,0,0.35); display:flex; align-items:center; justify-content:center; font-size:18px;">🛵</div>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });

        L.marker(restaurantCoord, { icon: restIcon })
          .addTo(map)
          .bindPopup(`<b>${restaurantName}</b><br>Pickup Point`);

        L.marker(customerCoord, { icon: customerIcon })
          .addTo(map)
          .bindPopup(`<b>Customer Drop Location</b><br>${customerArea}`);

        // Real road polyline along Ambikapur streets
        const initialRoute = buildRoutePoints(riderLat, riderLng);
        const polyline = L.polyline(initialRoute, {
          color: "#ea580c",
          weight: 5,
          opacity: 0.9,
          lineJoin: "round",
          lineCap: "round",
        }).addTo(map);
        routePolylineRef.current = polyline;

        // Position bike at real rider position OR mid-route
        const initialBikePos: [number, number] =
          riderLat && riderLng ? [riderLat, riderLng] : initialRoute[1];
        const bikeMarker = L.marker(initialBikePos, { icon: bikeIcon });
        if (riderLat != null && riderLng != null) bikeMarker.addTo(map);
        bikeMarkerRef.current = bikeMarker;

        mapInstanceRef.current = map;
        setMapLoaded(true);
        const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
        observer.observe(mapContainerRef.current);
        resizeObserverRef.current = observer;

        // Fit bounds to keep both restaurant & customer in frame
        map.fitBounds([restaurantCoord, customerCoord], {
          padding: [30, 30],
          maxZoom: 15,
        });

        // Leaflet invalidateSize after container paint
        setTimeout(() => {
          if (isMounted && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 150);

        setTimeout(() => {
          if (isMounted && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 500);
      } catch (err) {
        console.warn("Leaflet mount notice:", err);
      }
    };

    initLeaflet();

    return () => {
      isMounted = false;
      resizeObserverRef.current?.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const lastRouteFromRef = useRef<[number, number] | null>(null);

  // Real road routing via OSRM (free, no API key). Falls back to a straight line.
  // Origin = rider's live GPS when available, otherwise the restaurant.
  useEffect(() => {
    if (!mapLoaded) return;
    const hasGps = !!(riderLat && riderLng);
    const from: [number, number] = hasGps ? [riderLat as number, riderLng as number] : restaurantCoord;

    if (hasGps && bikeMarkerRef.current) {
      bikeMarkerRef.current.addTo(mapInstanceRef.current).setLatLng(from);
      // Keep the camera where the user put it; recenter is an explicit action.
    }

    // Re-route only when the rider moved ~40 m (keeps request volume low)
    const prev = lastRouteFromRef.current;
    if (prev && Math.abs(prev[0] - from[0]) < 0.0004 && Math.abs(prev[1] - from[1]) < 0.0004) return;
    lastRouteFromRef.current = from;

    const controller = new AbortController();
    (async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${customerCoord[1]},${customerCoord[0]}?overview=full&geometries=geojson`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error("Route unavailable");
        const data = await res.json();
        const route = data?.routes?.[0];
        if (!route) throw new Error("no route");
        setRouteAvailable(true);
        const pts = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
        routePolylineRef.current?.setLatLngs(pts);
        setEtaMinutes(Math.max(1, Math.round(route.duration / 60)));
      } catch (e: any) {
        if (e?.name === "AbortError") {
          lastRouteFromRef.current = null; // allow retry on next run
          return;
        }
        setRouteAvailable(false);
        routePolylineRef.current?.setLatLngs([from, customerCoord]);
        const km = Math.hypot(from[0] - customerCoord[0], from[1] - customerCoord[1]) * 111;
        setEtaMinutes(Math.max(3, Math.round(km * 4 + 2)));
      }
    })();

    return () => controller.abort();
  }, [riderLat, riderLng, mapLoaded]);

  // Handle Fullscreen transition: resize Leaflet canvas and fit bounds
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current.invalidateSize();
        if (isFullscreen) {
          mapInstanceRef.current.fitBounds([restaurantCoord, customerCoord], {
            padding: [60, 60],
          });
        }
      }, 150);
    }
  }, [isFullscreen]);

  const hasLocation = Number.isFinite(riderLat) && Number.isFinite(riderLng);
  const age = riderLocationUpdatedAt ? now - Date.parse(riderLocationUpdatedAt) : Infinity;
  const isRealGps = hasLocation && Number.isFinite(age) && age >= -5000 && age < 60000;
  const locationLabel = isRealGps ? "Recent rider location" : hasLocation ? "Last known location - updates delayed" : "Waiting for rider GPS";

  return (
    <div
      className={`transition-all duration-300 ${
        isFullscreen
          ? "fixed inset-0 z-[9999] w-screen h-screen bg-stone-900 rounded-none shadow-2xl flex flex-col"
          : "relative w-full rounded-2xl overflow-hidden border border-[#EDE5DA] bg-[#FAF7F2] shadow-xs group"
      }`}
      style={
        isFullscreen
          ? { height: "100vh", width: "100vw" }
          : { height, minHeight: height }
      }
    >
      {/* Actual Leaflet Map Canvas */}
      <div
        ref={mapContainerRef}
        className="w-full h-full z-0"
        style={{
          height: "100%",
          width: "100%",
          minHeight: isFullscreen ? "100vh" : height,
        }}
      />

      {/* NORMAL EMBEDDED MODE OVERLAYS */}
      {!isFullscreen && (
        <>
          {/* Floating Status Overlay Badge (Top Left) */}
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full border border-stone-200 text-xs font-bold shadow-md flex items-center gap-2 z-10 pointer-events-none">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isRealGps ? "bg-emerald-500 animate-ping" : "bg-emerald-500 animate-pulse"
              }`}
            />
            <span className="text-stone-800">
              {locationLabel}
            </span>
          </div>

          {/* Expand Fullscreen Button (Top Right) */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreen(true);
            }}
            className="absolute top-3 right-3 bg-white/95 hover:bg-white text-stone-900 text-[11px] font-black px-3 py-1.5 rounded-full border border-stone-200 shadow-md flex items-center gap-1.5 z-20 cursor-pointer transition active:scale-95 hover:shadow-lg"
            title="Click to view full screen interactive map"
          >
            <Maximize2 className="w-3.5 h-3.5 text-orange-600" />
            <span>Bada Map Dekhein</span>
          </button>

          {/* Mode Indicator Overlay Badge (Bottom Right) */}
          <div className="absolute bottom-8 right-3 bg-stone-900/80 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-black text-white shadow-xs z-10 pointer-events-none">
            Map • Tap to expand
          </div>
        </>
      )}

      {/* FULLSCREEN EXPANDED MODE OVERLAYS */}
      {isFullscreen && (
        <>
          {/* Top Floating App Bar */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20 pointer-events-auto">
            <div className="bg-white/95 backdrop-blur-md px-4 py-2 rounded-2xl border border-stone-200 text-xs font-black shadow-xl flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isRealGps ? "bg-emerald-500 animate-ping" : "bg-emerald-500 animate-pulse"
                }`}
              />
              <span className="text-stone-900">
                {locationLabel} • {routeAvailable ? `~${etaMinutes} mins travel estimate` : "Route unavailable - direct line"}
              </span>
            </div>

            <button
              onClick={() => setIsFullscreen(false)}
              className="bg-stone-900 hover:bg-black text-white px-4 py-2 rounded-2xl border border-stone-700 shadow-xl flex items-center gap-1.5 text-xs font-black transition cursor-pointer active:scale-95"
            >
              <X className="w-4 h-4 text-orange-400" />
              <span>Chhota Karein (Exit)</span>
            </button>
          </div>

          {/* Right Floating Map Controls (Zoom In, Zoom Out, Center Rider) */}
          <div className="absolute right-4 top-24 flex flex-col gap-2 z-20 pointer-events-auto">
            <button
              onClick={() => mapInstanceRef.current?.zoomIn()}
              className="w-11 h-11 rounded-2xl bg-white/95 shadow-xl border border-stone-200 flex items-center justify-center text-stone-800 font-black hover:bg-white active:scale-95 cursor-pointer"
              title="Zoom In"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              onClick={() => mapInstanceRef.current?.zoomOut()}
              className="w-11 h-11 rounded-2xl bg-white/95 shadow-xl border border-stone-200 flex items-center justify-center text-stone-800 font-black hover:bg-white active:scale-95 cursor-pointer"
              title="Zoom Out"
            >
              <Minus className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                const pos: [number, number] = riderLat && riderLng
                  ? [riderLat, riderLng]
                  : [(restaurantCoord[0] + customerCoord[0]) / 2, (restaurantCoord[1] + customerCoord[1]) / 2];
                mapInstanceRef.current?.panTo(pos, { animate: true });
              }}
              className="w-11 h-11 rounded-2xl bg-orange-600 text-white shadow-xl flex items-center justify-center hover:bg-orange-500 active:scale-95 cursor-pointer"
              title="Center on Rider"
            >
              <Navigation className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom Floating Delivery Card */}
          <div className="absolute bottom-10 left-4 right-4 max-w-lg mx-auto bg-white/95 backdrop-blur-md rounded-3xl p-4 border border-stone-200 shadow-2xl z-20 pointer-events-auto space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-stone-900">
                {orderNumber} • Ambikapur Live Delivery Route
              </span>
              <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {routeAvailable ? `~${etaMinutes} min driving estimate` : "Road route unavailable"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-2">
                <Store className="w-4 h-4 text-orange-600 shrink-0" />
                <div className="truncate">
                  <strong className="block text-stone-900 font-bold truncate">{restaurantName}</strong>
                  <span className="text-[10px] text-stone-500">Gandhi Chowk Pickup</span>
                </div>
              </div>

              <div className="p-2.5 bg-stone-50 rounded-2xl border border-stone-100 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <div className="truncate">
                  <strong className="block text-stone-900 font-bold truncate">Drop Location</strong>
                  <span className="text-[10px] text-stone-500 truncate">{customerArea}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
