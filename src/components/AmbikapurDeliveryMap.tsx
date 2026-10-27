"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker, Polyline } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Maximize2, Minimize2, Navigation, RefreshCw, Bike } from "lucide-react";
import { validCoords, distanceKm } from "@/lib/delivery";

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
  height = "300px",
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
  const fittedStage = useRef<number>(0);
  const routeCache = useRef<{ key: string; time: number } | null>(null);
  const animFrame = useRef<number | null>(null);
  const prevRiderPos = useRef<Point | null>(null);
  const riderBearing = useRef<number>(0);

  const [loaded, setLoaded] = useState(false);
  const [mapError, setMapError] = useState("");
  const [routeLabel, setRouteLabel] = useState("Locating pins on Google Map…");
  const [etaMinutes, setEtaMinutes] = useState<number | null>(null);
  const [distKm, setDistKm] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(Date.now());

  const pickup: Point | null = validCoords(restaurantLat, restaurantLng)
    ? [restaurantLat!, restaurantLng!]
    : null;
  const drop: Point | null = validCoords(customerLat, customerLng)
    ? [customerLat!, customerLng!]
    : null;
  const rider: Point | null = validCoords(riderLat, riderLng)
    ? [riderLat!, riderLng!]
    : null;

  const target = destination === "pickup" ? pickup : drop;
  const origin = rider || (destination === "drop" ? pickup : null);
  const routeFromKey = origin?.map((n) => String(Math.round(n * 2500) / 2500)).join(",") || "";
  const routeToKey = target?.join(",") || "";

  const gpsAge = riderLocationUpdatedAt ? now - Date.parse(riderLocationUpdatedAt) : Infinity;
  const isLiveGps = Boolean(rider && Number.isFinite(gpsAge) && gpsAge >= -5000 && gpsAge < 60000);
  const gpsLabel = rider
    ? isLiveGps
      ? "Rider GPS Live"
      : "Last known rider GPS"
    : "Waiting for rider GPS";

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  // Initialize Map with Google Maps Roadmap Tiles (shows all Ambikapur shops & streets!)
  useEffect(() => {
    let cancelled = false;
    let observer: ResizeObserver | undefined;
    let instance: LeafletMap | undefined;

    (async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || !container.current) return;

        instance = L.map(container.current, {
          center: [23.12, 83.1985],
          zoom: 15,
          scrollWheelZoom: false,
          zoomControl: false,
        });
        L.control.zoom({ position: "bottomright" }).addTo(instance);
        map.current = instance;

        // Google Maps Standard Roadmap Tiles (High-Detail Ambikapur POIs & Streets)
        L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
          subdomains: ["0", "1", "2", "3"],
          attribution: "&copy; Google Maps",
        })
          .on("tileerror", () => {
            if (!cancelled && instance) {
              L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(
                instance
              );
            }
          })
          .addTo(instance);

        dashedLine.current = L.polyline([], {
          color: "#fb923c",
          weight: 3,
          opacity: 0.45,
          dashArray: "6, 8",
        }).addTo(instance);

        line.current = L.polyline([], {
          color: "#E23744",
          weight: 5,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }).addTo(instance);

        observer = new ResizeObserver(() => instance?.invalidateSize({ pan: false }));
        observer.observe(container.current);
        setLoaded(true);
      } catch {
        if (!cancelled) setMapError("Map could not load. Refresh or use external navigation.");
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
    };
  }, []);

  // Update markers & smoothly interpolate Rider Bike along road
  useEffect(() => {
    if (!loaded || !map.current) return;
    let cancelled = false;

    (async () => {
      const L = await import("leaflet");
      if (cancelled || !map.current) return;

      const setStaticMarker = (
        id: string,
        point: Point | null,
        badgeHtml: string,
        label: string
      ) => {
        if (!point) {
          markers.current[id]?.remove();
          delete markers.current[id];
          return;
        }
        if (!map.current) return;
        const popup = document.createElement("div");
        popup.style.fontWeight = "700";
        popup.style.fontSize = "12px";
        popup.textContent = label;

        const icon = L.divIcon({
          className: "",
          html: badgeHtml,
          iconSize: [40, 40],
          iconAnchor: [20, 20],
        });

        if (markers.current[id]) {
          markers.current[id].setLatLng(point).setIcon(icon).setPopupContent(popup);
          return;
        }
        markers.current[id] = L.marker(point, { icon }).bindPopup(popup).addTo(map.current);
      };

      setStaticMarker(
        "pickup",
        pickup,
        `<div style="position:relative;width:38px;height:38px;border-radius:14px;background:#ea580c;border:3px solid #fff;box-shadow:0 4px 12px rgba(234,88,12,0.45);display:flex;align-items:center;justify-content:center;font-size:18px;">🏪</div>`,
        `Kitchen: ${restaurantName}`
      );

      setStaticMarker(
        "drop",
        drop,
        `<div style="position:relative;width:38px;height:38px;border-radius:14px;background:#16a34a;border:3px solid #fff;box-shadow:0 4px 12px rgba(22,163,74,0.45);display:flex;align-items:center;justify-content:center;font-size:18px;">🏠</div>`,
        `Drop: ${customerArea}`
      );

      // Rider marker with smooth 2.4s Linear Interpolation & Bearing Rotation
      if (!rider) {
        markers.current["rider"]?.remove();
        delete markers.current["rider"];
        prevRiderPos.current = null;
      } else {
        const makeRiderIcon = (deg: number) =>
          L.divIcon({
            className: "",
            html: `<div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
              <span style="position:absolute;inset:0;border-radius:9999px;background:rgba(226,55,68,0.22);animation:ping 1.8s cubic-bezier(0,0,0.2,1) infinite;"></span>
              <div style="position:relative;width:36px;height:36px;border-radius:9999px;background:#1c1917;border:3px solid #fff;box-shadow:0 4px 14px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;font-size:18px;transform:rotate(${Math.round(deg)}deg);transition:transform 0.4s ease;">🛵</div>
            </div>`,
            iconSize: [44, 44],
            iconAnchor: [22, 22],
          });

        if (!markers.current["rider"]) {
          markers.current["rider"] = L.marker(rider, {
            icon: makeRiderIcon(riderBearing.current),
            zIndexOffset: 1000,
          })
            .bindPopup("Delivery Partner Live GPS")
            .addTo(map.current);
          prevRiderPos.current = rider;
        } else {
          const startPos = prevRiderPos.current || ([
            markers.current["rider"].getLatLng().lat,
            markers.current["rider"].getLatLng().lng,
          ] as Point);
          const endPos = rider;

          // Calculate heading angle if rider moved
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
        map.current.fitBounds(L.latLngBounds(points).pad(0.22), { maxZoom: 16, animate: true });
        fittedStage.current = targetStage;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loaded, restaurantLat, restaurantLng, customerLat, customerLng, riderLat, riderLng, restaurantName, customerArea]);

  // Fetch Road Polyline + Snap-to-Road from /api/maps (Google Routes API + OSRM fallback)
  useEffect(() => {
    if (!loaded) return;
    if (!origin || !target) {
      line.current?.setLatLngs([]);
      dashedLine.current?.setLatLngs([]);
      setEtaMinutes(null);
      setDistKm(null);
      setRouteLabel(
        destination === "pickup"
          ? "Pickup GPS pin missing — ask kitchen to set pin"
          : "Customer delivery GPS pin missing — set pin below"
      );
      return;
    }

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
        setRouteLabel(
          `Google Live Route · ${kmStr} km · ~${mins} min`
        );
        routeCache.current = { key, time: Date.now() };
      } catch {
        if (!cancelled) {
          routeCache.current = null;
          line.current?.setLatLngs([from, to]);
          const fallbackKm = Math.max(0.2, straightKm * 1.25).toFixed(1);
          const fallbackMin = Math.max(3, Math.round((straightKm * 1.25) / 0.35));
          setDistKm(fallbackKm);
          setEtaMinutes(fallbackMin);
          setRouteLabel(`Direct Route · ~${fallbackKm} km · ~${fallbackMin} min`);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [loaded, routeFromKey, routeToKey, destination, retry]);

  useEffect(() => {
    setTimeout(() => map.current?.invalidateSize({ pan: false }), 100);
  }, [fullscreen]);

  function handleRecenter(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const points = [pickup, drop, rider].filter((p): p is Point => !!p);
    if (points.length && map.current) {
      map.current.fitBounds(points, { padding: [45, 45], maxZoom: 16, animate: true });
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
          : "relative flex flex-col overflow-hidden rounded-2xl border border-[#EDE5DA] bg-white shadow-sm"
      }
      aria-label={`Delivery map ${orderNumber || ""}`}
    >
      {/* Zomato-Style Top Live Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EDE5DA] bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 px-3.5 py-2.5 text-white">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isLiveGps ? "animate-ping bg-emerald-400" : "bg-amber-400"
              }`}
            />
            <span
              className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                isLiveGps ? "bg-emerald-500" : "bg-amber-400"
              }`}
            />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-orange-400">
                {gpsLabel}
              </span>
              {etaMinutes !== null && (
                <span className="rounded-full bg-orange-500/20 border border-orange-400/40 px-2 py-0.5 text-[10px] font-black text-orange-300">
                  {etaMinutes} MIN • {distKm} KM
                </span>
              )}
            </div>
            <p className="truncate text-[11px] text-stone-300 font-medium">
              {mapError || routeLabel}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleRecenter}
            title="Recenter Map Pins"
            className="flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 px-2.5 py-1.5 text-[11px] font-bold text-white transition cursor-pointer"
          >
            <Navigation size={13} className="text-orange-400" />
            <span className="hidden sm:inline">Center</span>
          </button>
          <button
            type="button"
            onClick={handleRetryRoute}
            title="Refresh Route"
            className="flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 p-1.5 text-white transition cursor-pointer"
          >
            <RefreshCw size={13} />
          </button>
          <button
            type="button"
            onClick={handleToggleFullscreen}
            title={fullscreen ? "Exit Fullscreen" : "Fullscreen Map"}
            className="flex items-center gap-1 rounded-lg bg-orange-600 hover:bg-orange-500 active:scale-95 px-2.5 py-1.5 text-[11px] font-bold text-white transition cursor-pointer shadow-xs"
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            <span>{fullscreen ? "Close" : "Expand"}</span>
          </button>
        </div>
      </div>

      {/* Interactive Google Map Canvas */}
      <div
        className="relative w-full flex-1 bg-stone-100"
        style={{ height: fullscreen ? "calc(100dvh - 96px)" : height, minHeight: height }}
      >
        <div ref={container} className="h-full w-full z-0" />

        {!loaded && !mapError && (
          <div className="absolute inset-0 z-[400] flex items-center justify-center bg-stone-100/80 backdrop-blur-xs">
            <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-stone-700 shadow-md">
              <Bike className="h-4 w-4 animate-bounce text-orange-600" />
              <span>Loading Google Maps…</span>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Legend & Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EDE5DA] bg-[#FAF7F2] px-3.5 py-2 text-[11px] font-bold text-stone-600">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-orange-600" />
            <span>Kitchen</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600" />
            <span>Customer</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-stone-900" />
            <span>Rider Bike</span>
          </span>
        </div>

        {mode === "rider" && target && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${target[0]},${target[1]}&travelmode=driving&dir_action=navigate`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-orange-600 hover:bg-orange-700 px-3 py-1 text-[11px] font-black text-white shadow-xs transition"
          >
            <Navigation size={12} />
            <span>Turn-by-Turn GPS ↗</span>
          </a>
        )}
      </div>
    </section>
  );
}
