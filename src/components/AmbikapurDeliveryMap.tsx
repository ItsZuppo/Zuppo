"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline, Polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2, LocateFixed, RefreshCw, Navigation } from "lucide-react";
import { validCoords, distanceKm, DELIVERY_CENTER } from "@/lib/delivery";
import {
  browserGetRoadRoute,
  computeBearingDegrees,
  snapRiderAlongPolyline,
  type LatLngTuple,
} from "@/lib/googleMapsBrowser";

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
  restaurantLat?: number;
  restaurantLng?: number;
  destination?: "pickup" | "drop";
}

type Point = LatLngTuple;

function makeTopDownRiderSvg(deg: number): string {
  // 360-degree top-down Zomato-style delivery scooter with headlight beam (0 deg = North)
  return `<div style="position:relative;width:54px;height:54px;display:flex;align-items:center;justify-content:center;transform:translate(-27px,-27px);pointer-events:none;">
    <span style="position:absolute;width:44px;height:44px;border-radius:9999px;background:rgba(239,79,95,0.22);animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>
    <div style="width:46px;height:46px;display:flex;align-items:center;justify-content:center;transform:rotate(${Math.round(
      deg
    )}deg);transition:transform 0.35s cubic-bezier(0.22,1,0.36,1);">
      <svg width="44" height="44" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 4px 8px rgba(15,23,42,0.35));">
        <!-- Headlight beam pointing North (0 deg) -->
        <path d="M32 14 L20 2 L44 2 Z" fill="url(#beamGrad)" opacity="0.75"/>
        <!-- Outer White Halo Circle -->
        <circle cx="32" cy="34" r="18" fill="#ffffff" stroke="#EF4F5F" stroke-width="3"/>
        <!-- Direction Arrow Nose at Top -->
        <path d="M32 11 L38 19 H26 L32 11 Z" fill="#EF4F5F"/>
        <!-- Front Wheel -->
        <rect x="29.5" y="18" width="5" height="7" rx="2.5" fill="#1e293b"/>
        <!-- Handlebar -->
        <rect x="22" y="23" width="20" height="3.2" rx="1.6" fill="#334155"/>
        <!-- Scooter Body -->
        <rect x="26" y="24" width="12" height="19" rx="6" fill="#EF4F5F"/>
        <!-- Rider Helmet (Top-down) -->
        <circle cx="32" cy="31" r="5.5" fill="#ffffff" stroke="#1e293b" stroke-width="1.8"/>
        <!-- Zuppo Red Delivery Box on Back -->
        <rect x="25" y="36" width="14" height="10" rx="2.5" fill="#be123c" stroke="#ffffff" stroke-width="1.2"/>
        <defs>
          <linearGradient id="beamGrad" x1="32" y1="14" x2="32" y2="2" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stop-color="#fef08a" stop-opacity="0.9"/>
            <stop offset="100%" stop-color="#fef08a" stop-opacity="0"/>
          </linearGradient>
        </defs>
      </svg>
    </div>
  </div>`;
}

export default function AmbikapurDeliveryMap({
  restaurantName = "Restaurant",
  customerArea = "Delivery address",
  mode = "customer",
  height = "340px",
  riderLat,
  riderLng,
  riderLocationUpdatedAt,
  customerLat,
  customerLng,
  restaurantLat,
  restaurantLng,
  destination = "drop",
}: DeliveryMapProps) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef<Record<string, Marker>>({});
  const casingLine = useRef<Polyline | null>(null);
  const line = useRef<Polyline | null>(null);
  const traveledLine = useRef<Polyline | null>(null);
  const dashedLine = useRef<Polyline | null>(null);
  const dropPolygon = useRef<Polygon | null>(null);
  const fittedStage = useRef<number>(0);
  const routePointsRef = useRef<Point[]>([]);
  const riderTrailRef = useRef<Point[]>([]);
  const animFrame = useRef<number | null>(null);
  const prevRiderPos = useRef<Point | null>(null);
  const riderBearing = useRef<number>(0);

  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState("");
  const [routeLabel, setRouteLabel] = useState("Calculating road route…");
  const [roadName, setRoadName] = useState<string>("");
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distKm, setDistKm] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [followRider, setFollowRider] = useState(true);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now());

  const pickup: Point = validCoords(restaurantLat, restaurantLng)
    ? [restaurantLat!, restaurantLng!]
    : [DELIVERY_CENTER.lat + 0.0032, DELIVERY_CENTER.lng - 0.0045];
  const drop: Point = validCoords(customerLat, customerLng)
    ? [customerLat!, customerLng!]
    : [DELIVERY_CENTER.lat - 0.0025, DELIVERY_CENTER.lng + 0.0035];
  const rawRider: Point | null = validCoords(riderLat, riderLng)
    ? [riderLat!, riderLng!]
    : null;
  const rider: Point = rawRider || [pickup[0] + 0.00015, pickup[1] - 0.00015];

  // Determine whether the active navigation leg is Rider->Pickup or Pickup/Rider->Customer
  const isPickupLeg =
    destination === "pickup" &&
    rawRider !== null &&
    distanceKm({ lat: rawRider[0], lng: rawRider[1] }, { lat: pickup[0], lng: pickup[1] }) > 0.03;

  const routeOrigin: Point = isPickupLeg ? rawRider! : pickup;
  const routeTarget: Point = isPickupLeg ? pickup : drop;

  const routeOriginKey = routeOrigin.map((n) => n.toFixed(4)).join(",");
  const routeTargetKey = routeTarget.map((n) => n.toFixed(4)).join(",");
  const riderKey = `${rider[0].toFixed(5)},${rider[1].toFixed(5)}`;

  const gpsAge = riderLocationUpdatedAt ? now - Date.parse(riderLocationUpdatedAt) : Infinity;
  const isLiveGps = Boolean(rawRider && Number.isFinite(gpsAge) && gpsAge >= -15000 && gpsAge < 90000);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 8000);
    return () => clearInterval(timer);
  }, []);

  // 1. Initialize Map with Google Maps Roadmap Tiles
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let instance: LeafletMap | undefined;

    (async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || !container.current) return;

        instance = L.map(container.current, {
          center: [drop[0], drop[1]],
          zoom: 15,
          scrollWheelZoom: false,
          zoomControl: false,
          attributionControl: false,
        });
        map.current = instance;

        // Disable auto-follow if user manually drags the map
        instance.on("dragstart", () => setFollowRider(false));

        const googleLayer = L.tileLayer(
          "https://mt1.google.com/vt/lyrs=m&hl=en&x={x}&y={y}&z={z}",
          { maxZoom: 20 }
        );
        googleLayer.on("tileerror", () => {
          if (!cancelled && instance) {
            L.tileLayer(
              "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
              { maxZoom: 19, subdomains: "abcd" }
            ).addTo(instance);
          }
        });
        googleLayer.addTo(instance);

        // Blue Zomato delivery zone highlight polygon around drop location
        dropPolygon.current = L.polygon([], {
          color: "#3b82f6",
          weight: 2,
          fillColor: "#60a5fa",
          fillOpacity: 0.22,
        }).addTo(instance);

        // Traveled path behind the rider ("rider ka track banta rahe")
        traveledLine.current = L.polyline([], {
          color: "#64748b",
          weight: 4,
          opacity: 0.65,
          dashArray: "4, 7",
          lineCap: "round",
        }).addTo(instance);

        // Preview dashed line
        dashedLine.current = L.polyline([], {
          color: "#EF4F5F",
          weight: 3,
          opacity: 0.45,
          dashArray: "6, 8",
        }).addTo(instance);

        // Outer road casing for active route ahead
        casingLine.current = L.polyline([], {
          color: "#9f1239",
          weight: 8,
          opacity: 0.35,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(instance);

        // Active road route ahead of the rider
        line.current = L.polyline([], {
          color: "#EF4F5F",
          weight: 5,
          opacity: 0.96,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(instance);

        observer = new ResizeObserver(() => instance?.invalidateSize({ pan: false }));
        observer.observe(container.current);

        setTimeout(() => {
          if (!cancelled && instance) instance.invalidateSize({ pan: false });
        }, 120);

        setLoaded(true);
      } catch {
        if (!cancelled) setMapError("Map could not load. Please refresh.");
      }
    })();

    return () => {
      cancelled = true;
      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      observer?.disconnect();
      instance?.remove();
      map.current = null;
      markers.current = {};
      casingLine.current = null;
      line.current = null;
      traveledLine.current = null;
      dashedLine.current = null;
      dropPolygon.current = null;
    };
  }, []);

  // 2. Fetch Full Road Polyline via Official Google Maps DirectionsService (with OSRM fallback)
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;

    (async () => {
      const routeData = await browserGetRoadRoute(routeOrigin, routeTarget, rider);
      if (cancelled) return;

      routePointsRef.current = routeData.fullCoords;
      casingLine.current?.setLatLngs(routeData.remainingCoords);
      line.current?.setLatLngs(routeData.remainingCoords);

      // Combine road-traveled path with live rider trail breadcrumbs
      const trail =
        riderTrailRef.current.length > 1
          ? riderTrailRef.current
          : routeData.traveledCoords;
      traveledLine.current?.setLatLngs(trail);

      // If on pickup leg, also show dashed line from restaurant to customer drop
      if (isPickupLeg) {
        dashedLine.current?.setLatLngs([pickup, drop]);
      } else {
        dashedLine.current?.setLatLngs([]);
      }

      if (typeof routeData.bearing === "number" && Number.isFinite(routeData.bearing)) {
        riderBearing.current = routeData.bearing;
      }

      setDistKm(routeData.distanceKm);
      setEtaMinutes(routeData.durationMinutes);
      setRoadName(routeData.roadSummary || (isPickupLeg ? "Heading to Restaurant" : "On Road to Customer"));
      setRouteLabel(`${routeData.distanceKm} km • ~${routeData.durationMinutes} min`);
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, routeOriginKey, routeTargetKey, isPickupLeg, retry]);

  // 3. Update Pins, Snap Rider to Road, Draw Traveled Trail & Smoothly Rotate/Glide Bike
  useEffect(() => {
    if (!loaded || !map.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !map.current) return;

      // Update blue polygon around customer drop location
      const [dLat, dLng] = drop;
      dropPolygon.current?.setLatLngs([
        [dLat + 0.00055, dLng - 0.00045],
        [dLat + 0.00065, dLng + 0.00035],
        [dLat + 0.00015, dLng + 0.00065],
        [dLat - 0.00050, dLng + 0.00040],
        [dLat - 0.00055, dLng - 0.00035],
        [dLat - 0.00010, dLng - 0.00060],
      ]);

      const setZomatoMarker = (
        id: string,
        point: Point,
        pillTitle: string,
        dotColor: string,
        isMainDrop = false
      ) => {
        if (!map.current) return;
        const cleanTitle =
          pillTitle.length > 24 ? pillTitle.slice(0, 22) + "…" : pillTitle;

        const html = isMainDrop
          ? `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
              <div style="background:#1c1917;color:#fff;font-size:11px;font-weight:800;padding:5px 12px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.28);">
                📍 ${cleanTitle}
              </div>
              <div style="width:2px;height:10px;background:#1c1917;"></div>
              <div style="width:14px;height:14px;border-radius:999px;background:#1c1917;border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
            </div>`
          : `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
              <div style="background:#fff;color:#1c1917;border:1.5px solid ${dotColor};font-size:10px;font-weight:800;padding:3px 9px;border-radius:999px;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.15);">
                🏪 ${cleanTitle}
              </div>
              <div style="width:2px;height:6px;background:${dotColor};"></div>
              <div style="width:12px;height:12px;border-radius:999px;background:${dotColor};border:2.5px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.25);"></div>
            </div>`;

        const icon = L.divIcon({
          className: "",
          html,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        if (markers.current[id]) {
          markers.current[id].setLatLng(point).setIcon(icon);
          return;
        }
        markers.current[id] = L.marker(point, { icon }).addTo(map.current);
      };

      const shortDropName = customerArea.split(",")[0]?.trim() || "Customer Drop";
      setZomatoMarker("pickup", pickup, restaurantName, "#ea580c", false);
      setZomatoMarker("drop", drop, shortDropName, "#1c1917", true);

      // Snap rider to the road polyline so the bike moves on the road and slices remaining route
      let targetRiderPos: Point = rider;
      if (routePointsRef.current.length >= 2) {
        const snap = snapRiderAlongPolyline(routePointsRef.current, rider);
        targetRiderPos = snap.snapped;
        casingLine.current?.setLatLngs(snap.remaining);
        line.current?.setLatLngs(snap.remaining);

        // Append to breadcrumb trail ("rider ka track banta rahe")
        const lastTrail = riderTrailRef.current[riderTrailRef.current.length - 1];
        if (
          !lastTrail ||
          distanceKm({ lat: lastTrail[0], lng: lastTrail[1] }, { lat: targetRiderPos[0], lng: targetRiderPos[1] }) > 0.003
        ) {
          riderTrailRef.current = [...riderTrailRef.current.slice(-80), targetRiderPos];
        }
        traveledLine.current?.setLatLngs(
          snap.traveled.length >= 2 ? snap.traveled : riderTrailRef.current
        );

        const remKm = distanceKm(
          { lat: targetRiderPos[0], lng: targetRiderPos[1] },
          { lat: routeTarget[0], lng: routeTarget[1] }
        );
        const remDistStr = Math.max(0.1, remKm * 1.2).toFixed(1);
        const remMins = Math.max(1, Math.round((remKm * 1.2) / 0.38));
        setDistKm(remDistStr);
        setEtaMinutes(remMins);
        setRouteLabel(`${remDistStr} km • ~${remMins} min`);

        if (snap.bearing) {
          riderBearing.current = snap.bearing;
        }
      } else {
        riderBearing.current = computeBearingDegrees(rider, routeTarget);
      }

      const makeRiderIcon = (deg: number) =>
        L.divIcon({
          className: "",
          html: makeTopDownRiderSvg(deg),
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

      if (!markers.current["rider"]) {
        markers.current["rider"] = L.marker(targetRiderPos, {
          icon: makeRiderIcon(riderBearing.current),
          zIndexOffset: 1000,
        }).addTo(map.current);
        prevRiderPos.current = targetRiderPos;
      } else {
        const startPos = prevRiderPos.current || ([
          markers.current["rider"].getLatLng().lat,
          markers.current["rider"].getLatLng().lng,
        ] as Point);
        const endPos = targetRiderPos;

        // If rider moved > 1.5m, compute exact movement heading so bike rotates smoothly into the turn
        if (
          Math.abs(endPos[0] - startPos[0]) > 0.000012 ||
          Math.abs(endPos[1] - startPos[1]) > 0.000012
        ) {
          riderBearing.current = computeBearingDegrees(startPos, endPos);
        }
        markers.current["rider"].setIcon(makeRiderIcon(riderBearing.current));

        if (animFrame.current) cancelAnimationFrame(animFrame.current);
        const startTime = performance.now();
        const duration = 1800;

        const animate = (t: number) => {
          const p = Math.min(1, (t - startTime) / duration);
          const lat = startPos[0] + (endPos[0] - startPos[0]) * p;
          const lng = startPos[1] + (endPos[1] - startPos[1]) * p;
          markers.current["rider"]?.setLatLng([lat, lng]);
          prevRiderPos.current = [lat, lng];
          if (p < 1 && !cancelled) {
            animFrame.current = requestAnimationFrame(animate);
          }
        };
        animFrame.current = requestAnimationFrame(animate);

        if (followRider && rawRider && map.current) {
          map.current.panTo(endPos, { animate: true, duration: 1.2 });
        }
      }

      const points = [pickup, drop, targetRiderPos];
      const targetStage = rawRider ? 2 : 1;
      if (fittedStage.current < targetStage) {
        map.current.fitBounds(L.latLngBounds(points).pad(0.28), { maxZoom: 16, animate: true });
        fittedStage.current = targetStage;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, restaurantLat, restaurantLng, customerLat, customerLng, riderKey, restaurantName, customerArea, followRider]);

  useEffect(() => {
    setTimeout(() => map.current?.invalidateSize({ pan: false }), 120);
  }, [fullscreen]);

  function handleRecenter(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFollowRider(true);
    const points = [pickup, drop, rider];
    if (map.current) {
      map.current.fitBounds(points, { padding: [48, 48], maxZoom: 16, animate: true });
    }
  }

  function handleRetryRoute(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setRetry((v) => v + 1);
  }

  function handleToggleFullscreen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFullscreen((v) => !v);
  }

  if (mapError) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-xs text-stone-600">
        {mapError}
      </div>
    );
  }

  const resolvedHeight = fullscreen ? "calc(100dvh - 80px)" : height;
  const activeNavBanner =
    destination === "pickup"
      ? `Pickup at ${restaurantName}`
      : `Deliver to ${customerArea.split(",")[0]?.trim() || "Customer"}`;

  return (
    <section
      aria-label="Ambikapur delivery map"
      className={
        fullscreen
          ? "fixed inset-3 z-50 flex flex-col overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
          : "relative overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xs"
      }
    >
      {/* Live Navigation Status Bar for both Customer & Rider */}
      <div className="flex items-center justify-between gap-2 bg-slate-900 px-3.5 py-2 text-white">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EF4F5F] text-white">
            <Navigation className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black leading-tight">{activeNavBanner}</p>
            <p className="truncate text-[10px] font-medium text-slate-300">
              {roadName ? `Via ${roadName} • ` : ""}
              {isLiveGps ? "Live Rider GPS on road" : "Live road route active"}
            </p>
          </div>
        </div>
        {distKm && etaMinutes && (
          <div className="shrink-0 rounded-xl bg-white/10 px-2.5 py-1 text-right">
            <span className="block text-[11px] font-black text-emerald-400">~{etaMinutes} min</span>
            <span className="block text-[9px] font-bold text-slate-300">{distKm} km</span>
          </div>
        )}
      </div>

      <div
        className="relative w-full bg-stone-100"
        style={{ height: resolvedHeight, minHeight: "260px" }}
      >
        <div
          ref={container}
          style={{ width: "100%", height: resolvedHeight, minHeight: "260px" }}
          className="w-full"
        />

        {/* Top-left Live Status Pill */}
        <div className="pointer-events-none absolute top-3 left-3 z-[400] flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-extrabold text-stone-900 shadow-md backdrop-blur-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              isLiveGps ? "bg-emerald-500 animate-ping" : "bg-[#EF4F5F]"
            }`}
          />
          <span>{routeLabel}</span>
        </div>

        {/* Top-right Map Action Buttons */}
        <div className="absolute top-3 right-3 z-[400] flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRetryRoute}
            title="Refresh Route"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-stone-700 shadow-md hover:bg-white cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-stone-700 shadow-md hover:bg-white cursor-pointer"
          >
            {fullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>

        {/* Bottom-left Google Watermark */}
        <div className="pointer-events-none absolute bottom-2.5 left-3 z-[400] select-none text-[13px] font-bold tracking-tight text-stone-600 drop-shadow-[0_1px_1px_rgba(255,255,255,0.9)]">
          Google
        </div>

        {/* Bottom-right Zomato GPS Recenter / Follow Bike Crosshair Button */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Follow Rider & Fit Route"
          className={`absolute right-3 bottom-3 z-[400] flex h-10 w-10 items-center justify-center rounded-full border shadow-lg transition cursor-pointer ${
            followRider
              ? "border-[#EF4F5F] bg-[#EF4F5F] text-white"
              : "border-stone-200 bg-white text-stone-800 hover:bg-stone-50"
          }`}
        >
          <LocateFixed className="h-5 w-5" />
        </button>
      </div>
    </section>
  );
}
