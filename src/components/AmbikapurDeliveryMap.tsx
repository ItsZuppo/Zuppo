"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline, Polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2, LocateFixed, RefreshCw, Bike } from "lucide-react";
import { validCoords, distanceKm, DELIVERY_CENTER } from "@/lib/delivery";

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

type Point = [number, number];

export default function AmbikapurDeliveryMap({
  restaurantName = "Restaurant",
  customerArea = "Delivery address",
  orderNumber,
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
  const line = useRef<Polyline | null>(null);
  const dashedLine = useRef<Polyline | null>(null);
  const dropPolygon = useRef<Polygon | null>(null);
  const fittedStage = useRef<number>(0);
  const routeCache = useRef<{ key: string; time: number } | null>(null);
  const animFrame = useRef<number | null>(null);
  const prevRiderPos = useRef<Point | null>(null);
  const riderBearing = useRef<number>(0);

  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState("");
  const [routeLabel, setRouteLabel] = useState("Live route active");
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distKm, setDistKm] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now());

  // Safe coordinates with Ambikapur fallback so the map NEVER shows blank/empty pins
  const pickup: Point = validCoords(restaurantLat, restaurantLng)
    ? [restaurantLat!, restaurantLng!]
    : [DELIVERY_CENTER.lat + 0.0032, DELIVERY_CENTER.lng - 0.0045];
  const drop: Point = validCoords(customerLat, customerLng)
    ? [customerLat!, customerLng!]
    : [DELIVERY_CENTER.lat - 0.0025, DELIVERY_CENTER.lng + 0.0035];
  const rider: Point | null = validCoords(riderLat, riderLng)
    ? [riderLat!, riderLng!]
    : null;

  const target = destination === "pickup" ? pickup : drop;
  const origin = rider || (destination === "drop" ? pickup : null);
  const routeFromKey = origin?.map((n) => String(Math.round(n * 2500) / 2500)).join(",") || "";
  const routeToKey = target?.join(",") || "";

  const gpsAge = riderLocationUpdatedAt ? now - Date.parse(riderLocationUpdatedAt) : Infinity;
  const isLiveGps = Boolean(rider && Number.isFinite(gpsAge) && gpsAge >= -5000 && gpsAge < 60000);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Leaflet with Google Maps Tiles & explicit height
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

        // Primary: Google Maps Standard Roadmap Tiles (Exact Google Maps look with POIs)
        const googleLayer = L.tileLayer(
          "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
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

        // Zomato-style blue delivery zone highlight polygon around drop location
        dropPolygon.current = L.polygon([], {
          color: "#3b82f6",
          weight: 2,
          fillColor: "#60a5fa",
          fillOpacity: 0.22,
        }).addTo(instance);

        dashedLine.current = L.polyline([], {
          color: "#EF4F5F",
          weight: 3,
          opacity: 0.45,
          dashArray: "6, 8",
        }).addTo(instance);

        line.current = L.polyline([], {
          color: "#EF4F5F",
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(instance);

        observer = new ResizeObserver(() => instance?.invalidateSize({ pan: false }));
        observer.observe(container.current);

        // Ensure container size is recalculated after paint
        setTimeout(() => {
          if (!cancelled && instance) {
            instance.invalidateSize({ pan: false });
          }
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
      line.current = null;
      dashedLine.current = null;
      dropPolygon.current = null;
    };
  }, []);

  // Update Zomato-style black pill markers, blue POI polygon & smooth Rider Bike
  useEffect(() => {
    if (!loaded || !map.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !map.current) return;

      // Draw Zomato-style blue society/building polygon around customer drop pin
      if (drop && dropPolygon.current) {
        const [dLat, dLng] = drop;
        dropPolygon.current.setLatLngs([
          [dLat + 0.00055, dLng - 0.00045],
          [dLat + 0.00065, dLng + 0.00035],
          [dLat + 0.00015, dLng + 0.00065],
          [dLat - 0.00050, dLng + 0.00040],
          [dLat - 0.00055, dLng - 0.00035],
          [dLat - 0.00010, dLng - 0.00060],
        ]);
      }

      const setZomatoMarker = (
        id: string,
        point: Point | null,
        pillTitle: string,
        dotColor: string,
        isMainDrop = false
      ) => {
        if (!point) {
          markers.current[id]?.remove();
          delete markers.current[id];
          return;
        }
        if (!map.current) return;

        const cleanTitle =
          pillTitle.length > 22 ? pillTitle.slice(0, 20) + "…" : pillTitle;

        const html = isMainDrop
          ? `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%);">
              <div style="background:#1c1917;color:#fff;font-size:11px;font-weight:800;padding:5px 12px;border-radius:999px;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.28);letter-spacing:0.01em;">
                ${cleanTitle}
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

      const shortDropName = customerArea.split(",")[0]?.trim() || "Delivery Location";
      setZomatoMarker("pickup", pickup, restaurantName, "#ea580c", false);
      setZomatoMarker("drop", drop, shortDropName, "#1c1917", true);

      // Rider Live Bike Marker with Smooth Glide
      if (!rider) {
        markers.current["rider"]?.remove();
        delete markers.current["rider"];
        prevRiderPos.current = null;
      } else {
        const makeRiderIcon = (deg: number) =>
          L.divIcon({
            className: "",
            html: `<div style="position:relative;width:48px;height:48px;display:flex;align-items:center;justify-content:center;transform:translate(-24px,-24px);">
              <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(239,79,95,0.25);animation:ping 1.6s cubic-bezier(0,0,0.2,1) infinite;"></span>
              <div style="position:relative;width:38px;height:38px;border-radius:9999px;background:#EF4F5F;border:3px solid #fff;box-shadow:0 6px 16px rgba(239,79,95,0.45);display:flex;align-items:center;justify-content:center;font-size:19px;transform:rotate(${Math.round(deg)}deg);transition:transform 0.35s ease;">🛵</div>
            </div>`,
            iconSize: [0, 0],
            iconAnchor: [0, 0],
          });

        if (!markers.current["rider"]) {
          markers.current["rider"] = L.marker(rider, {
            icon: makeRiderIcon(riderBearing.current),
            zIndexOffset: 1000,
          }).addTo(map.current);
          prevRiderPos.current = rider;
        } else {
          const startPos = prevRiderPos.current || ([
            markers.current["rider"].getLatLng().lat,
            markers.current["rider"].getLatLng().lng,
          ] as Point);
          const endPos = rider;

          if (
            Math.abs(endPos[0] - startPos[0]) > 0.00002 ||
            Math.abs(endPos[1] - startPos[1]) > 0.00002
          ) {
            const dLon = ((endPos[1] - startPos[1]) * Math.PI) / 180;
            const lat1 = (startPos[0] * Math.PI) / 180;
            const lat2 = (endPos[0] * Math.PI) / 180;
            const y = Math.sin(dLon) * Math.cos(lat2);
            const x =
              Math.cos(lat1) * Math.sin(lat2) -
              Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
            riderBearing.current = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
            markers.current["rider"].setIcon(makeRiderIcon(riderBearing.current));
          }

          if (animFrame.current) cancelAnimationFrame(animFrame.current);
          const startTime = performance.now();
          const duration = 2400;

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
        }
      }

      const points = [pickup, drop, rider].filter((p): p is Point => !!p);
      const targetStage = rider ? 2 : points.length > 0 ? 1 : 0;
      if (points.length > 0 && fittedStage.current < targetStage) {
        map.current.fitBounds(L.latLngBounds(points).pad(0.28), { maxZoom: 16, animate: true });
        fittedStage.current = targetStage;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, restaurantLat, restaurantLng, customerLat, customerLng, riderLat, riderLng, restaurantName, customerArea]);

  // Road Route Calculation via /api/maps
  useEffect(() => {
    if (!loaded || !origin || !target) return;

    dashedLine.current?.setLatLngs([origin, target]);
    const straightKm = distanceKm(
      { lat: origin[0], lng: origin[1] },
      { lat: target[0], lng: target[1] }
    );

    const key = [...origin, ...target].map((n) => n.toFixed(4)).join(",");
    if (routeCache.current?.key === key && Date.now() - routeCache.current.time < 25000) return;

    const controller = new AbortController();
    let cancelled = false;
    const from = [...origin] as Point;
    const to = [...target] as Point;

    (async () => {
      try {
        const r = await fetch(
          `/api/maps?action=route&fromLat=${from[0]}&fromLng=${from[1]}&toLat=${to[0]}&toLng=${to[1]}`,
          { signal: controller.signal }
        );
        const d = await r.json();
        if (!d.success || !d.coordinates?.length) throw Error("No route");
        if (cancelled) return;

        line.current?.setLatLngs(d.coordinates);
        dashedLine.current?.setLatLngs([]);

        const kmStr = String(d.distanceKm);
        const mins = Number(d.durationMinutes);
        setDistKm(kmStr);
        setEtaMinutes(mins);
        setRouteLabel(`${kmStr} km • ~${mins} min`);
        routeCache.current = { key, time: Date.now() };
      } catch {
        if (!cancelled) {
          routeCache.current = null;
          line.current?.setLatLngs([from, to]);
          const fallbackKm = Math.max(0.4, straightKm * 1.25).toFixed(1);
          const fallbackMin = Math.max(4, Math.round((straightKm * 1.25) / 0.35));
          setDistKm(fallbackKm);
          setEtaMinutes(fallbackMin);
          setRouteLabel(`${fallbackKm} km • ~${fallbackMin} min`);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loaded, routeFromKey, routeToKey, destination, retry]);

  useEffect(() => {
    setTimeout(() => map.current?.invalidateSize({ pan: false }), 120);
  }, [fullscreen]);

  function handleRecenter(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const points = [pickup, drop, rider].filter((p): p is Point => !!p);
    if (points.length && map.current) {
      map.current.fitBounds(points, { padding: [50, 50], maxZoom: 16, animate: true });
    }
  }

  function handleRetryRoute(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    routeCache.current = null;
    setRetry((v) => v + 1);
  }

  function handleToggleFullscreen(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setFullscreen((v) => !v);
  }

  return (
    <section
      className={
        fullscreen
          ? "fixed inset-0 z-[9999] flex flex-col bg-white"
          : "relative overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-xs"
      }
      aria-label={`Delivery map ${orderNumber || ""}`}
    >
      {/* Map Canvas with Explicit Height so it NEVER renders blank/grey */}
      <div
        className="relative w-full overflow-hidden bg-[#e8ede5]"
        style={{
          height: fullscreen ? "calc(100dvh - 60px)" : height,
          minHeight: height,
        }}
      >
        <div
          ref={container}
          style={{
            width: "100%",
            height: fullscreen ? "calc(100dvh - 60px)" : height,
          }}
        />

        {/* Top-Left Live Floating Pill (Zomato Style) */}
        <div className="pointer-events-none absolute left-3 top-3 z-[800] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow-md border border-stone-200/80 backdrop-blur-xs">
          <span
            className={`h-2 w-2 rounded-full ${
              isLiveGps ? "bg-emerald-500 animate-ping" : "bg-[#EF4F5F]"
            }`}
          />
          <span className="text-[11px] font-extrabold text-stone-800">
            {isLiveGps ? "Rider Live on Map" : routeLabel}
          </span>
        </div>

        {/* Top-Right Floating Map Controls */}
        <div className="absolute right-3 top-3 z-[800] flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleRetryRoute}
            title="Refresh Route"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-stone-700 shadow-md border border-stone-200/80 hover:bg-stone-50 active:scale-95 transition cursor-pointer"
          >
            <RefreshCw size={14} />
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={fullscreen ? "Close Fullscreen" : "Expand Map"}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-stone-700 shadow-md border border-stone-200/80 hover:bg-stone-50 active:scale-95 transition cursor-pointer"
          >
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>

        {/* Bottom-Left Google Watermark (Exact Zomato Style) */}
        <div className="pointer-events-none absolute bottom-2.5 left-3 z-[800] select-none font-sans text-sm font-black tracking-tight text-stone-700 drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]">
          Google
        </div>

        {/* Bottom-Right Zomato GPS Target Crosshair Button */}
        <button
          type="button"
          onClick={handleRecenter}
          title="Recenter Map"
          className="absolute bottom-3 right-3 z-[800] flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-900 shadow-lg border border-stone-200 hover:bg-stone-50 active:scale-95 transition cursor-pointer"
        >
          <LocateFixed size={18} className="text-stone-800" />
        </button>

        {!loaded && !mapError && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-stone-100/80">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-700 shadow-md">
              <Bike className="h-4 w-4 animate-bounce text-[#EF4F5F]" />
              <span>Loading Map…</span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
