"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { ArrowLeft, CheckCircle2, LocateFixed } from "lucide-react";
import { DELIVERY_CENTER, isServiceable, validCoords } from "@/lib/delivery";

interface ZomatoLocationModalProps {
  open: boolean;
  initialLat?: number;
  initialLng?: number;
  initialAddress?: string;
  onClose: () => void;
  onConfirm: (data: {
    lat: number;
    lng: number;
    placeTitle: string;
    fullAddress: string;
  }) => void;
}

export default function ZomatoLocationModal({
  open,
  initialLat,
  initialLng,
  initialAddress = "Gandhi Chowk, Ambikapur",
  onClose,
  onConfirm,
}: ZomatoLocationModalProps) {
  const [lat, setLat] = useState<number>(
    validCoords(initialLat, initialLng) ? initialLat! : DELIVERY_CENTER.lat
  );
  const [lng, setLng] = useState<number>(
    validCoords(initialLat, initialLng) ? initialLng! : DELIVERY_CENTER.lng
  );
  const [placeTitle, setPlaceTitle] = useState<string>(
    initialAddress.split(",")[0]?.trim() || "Gandhi Chowk"
  );
  const [fullAddress, setFullAddress] = useState<string>(initialAddress);
  const [houseDetails, setHouseDetails] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const polygonRef = useRef<Polygon | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePolygon = (cLat: number, cLng: number) => {
    polygonRef.current?.setLatLngs([
      [cLat + 0.00055, cLng - 0.00045],
      [cLat + 0.00065, cLng + 0.00035],
      [cLat + 0.00015, cLng + 0.00065],
      [cLat - 0.00050, cLng + 0.00040],
      [cLat - 0.00055, cLng - 0.00035],
      [cLat - 0.00010, cLng - 0.00060],
    ]);
  };

  const reverseGeocode = (newLat: number, newLng: number) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/maps?action=geocode&lat=${newLat}&lng=${newLng}`);
        const d = await r.json();
        if (d.success && d.address) {
          const parts = String(d.address).split(",");
          setPlaceTitle(parts[0]?.trim() || "Ambikapur");
          setFullAddress(d.address);
        }
      } catch {}
    }, 320);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let instance: LeafletMap | undefined;

    (async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || !mapContainerRef.current) return;

        instance = L.map(mapContainerRef.current, {
          center: [lat, lng],
          zoom: 17,
          zoomControl: false,
          attributionControl: false,
        });
        mapRef.current = instance;

        L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
        }).addTo(instance);

        polygonRef.current = L.polygon([], {
          color: "#3b82f6",
          weight: 2,
          fillColor: "#60a5fa",
          fillOpacity: 0.24,
        }).addTo(instance);
        updatePolygon(lat, lng);

        setTimeout(() => {
          if (!cancelled && instance) instance.invalidateSize({ pan: false });
        }, 120);

        instance.on("move", () => {
          if (!instance) return;
          const c = instance.getCenter();
          updatePolygon(c.lat, c.lng);
        });

        instance.on("moveend", () => {
          if (!instance) return;
          const c = instance.getCenter();
          setLat(Number(c.lat.toFixed(6)));
          setLng(Number(c.lng.toFixed(6)));
          updatePolygon(c.lat, c.lng);
          reverseGeocode(c.lat, c.lng);
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      instance?.remove();
      mapRef.current = null;
      polygonRef.current = null;
    };
  }, [open]);

  function handleLocateGps() {
    setError("");
    if (!navigator.geolocation || !window.isSecureContext) {
      setError("GPS requires HTTPS. Drag the map to select your location.");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = Number(pos.coords.latitude.toFixed(6));
        const newLng = Number(pos.coords.longitude.toFixed(6));
        setBusy(false);
        if (!isServiceable(newLat, newLng)) {
          setError("Your current GPS is outside Ambikapur (12 km radius). Drag map inside Ambikapur.");
          return;
        }
        setLat(newLat);
        setLng(newLng);
        mapRef.current?.setView([newLat, newLng], 17, { animate: true });
        updatePolygon(newLat, newLng);
        reverseGeocode(newLat, newLng);
      },
      () => {
        setBusy(false);
        setError("Location permission blocked. Drag the map to place the pin on your house.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function handleConfirm() {
    if (!isServiceable(lat, lng)) {
      setError("Please move the pin inside our 12 km Ambikapur delivery zone.");
      return;
    }
    const finalAddress = houseDetails.trim()
      ? `${houseDetails.trim()}, ${fullAddress}`
      : fullAddress;
    onConfirm({
      lat,
      lng,
      placeTitle,
      fullAddress: finalAddress,
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/60 backdrop-blur-xs animate-in fade-in"
      />

      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Top Interactive Google Map with Blue Polygon & Black Pill Pin */}
        <div className="relative w-full bg-[#e8ede5]" style={{ height: "340px" }}>
          <div ref={mapContainerRef} style={{ width: "100%", height: "340px" }} />

          {/* Top-Left Back Arrow */}
          <button
            type="button"
            onClick={onClose}
            className="absolute left-3.5 top-3.5 z-[800] flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-900 shadow-md hover:bg-stone-50 cursor-pointer"
          >
            <ArrowLeft size={18} />
          </button>

          {/* Center Zomato Black Pill Tooltip + Pin */}
          <div className="pointer-events-none absolute inset-0 z-[700] flex items-center justify-center">
            <div className="-translate-y-6 flex flex-col items-center">
              <div className="rounded-full bg-stone-900 px-4 py-1.5 text-xs font-extrabold text-white shadow-xl whitespace-nowrap max-w-[230px] truncate">
                {placeTitle}
              </div>
              <div className="h-3.5 w-0.5 bg-stone-900" />
              <div className="h-3.5 w-3.5 rounded-full bg-stone-900 border-2 border-white shadow-md" />
            </div>
          </div>

          {/* Bottom-Left Google Watermark */}
          <div className="pointer-events-none absolute bottom-2.5 left-3.5 z-[800] select-none font-sans text-sm font-black tracking-tight text-stone-700 drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]">
            Google
          </div>

          {/* Bottom-Right GPS Target Crosshair Button */}
          <button
            type="button"
            disabled={busy}
            onClick={handleLocateGps}
            title="Use Current GPS"
            className="absolute bottom-3.5 right-3.5 z-[800] flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-900 shadow-lg border border-stone-200 hover:bg-stone-50 active:scale-95 transition cursor-pointer"
          >
            <LocateFixed size={18} />
          </button>
        </div>

        {/* Bottom White Sheet — Exact Zomato Layout */}
        <div className="bg-white p-5 space-y-4">
          <h3 className="text-base font-extrabold text-stone-900">
            Select delivery location
          </h3>

          <div className="space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              YOUR LOCATION
            </span>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2 min-w-0">
                <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <strong className="text-sm font-extrabold text-stone-900 block truncate">
                    {placeTitle}
                  </strong>
                  <span className="text-xs text-stone-500 block leading-snug line-clamp-2">
                    {fullAddress}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={handleLocateGps}
                className="text-xs font-extrabold text-[#EF4F5F] uppercase shrink-0 cursor-pointer pt-0.5"
              >
                {busy ? "LOCATING…" : "CHANGE"}
              </button>
            </div>
          </div>

          {/* Quick Ambikapur Area Chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { name: "Gandhi Chowk", lat: 23.12341, lng: 83.1933 },
              { name: "Ghadi Chowk", lat: 23.12295, lng: 83.19799 },
              { name: "Kedarpur", lat: 23.11559, lng: 83.20455 },
              { name: "Ring Road East", lat: 23.11801, lng: 83.20313 },
              { name: "Mahamaya Road", lat: 23.1315, lng: 83.1892 },
            ].map((spot) => (
              <button
                key={spot.name}
                type="button"
                onClick={() => {
                  setLat(spot.lat);
                  setLng(spot.lng);
                  setPlaceTitle(spot.name);
                  setFullAddress(`${spot.name}, Ambikapur, Chhattisgarh`);
                  mapRef.current?.setView([spot.lat, spot.lng], 17, { animate: true });
                  updatePolygon(spot.lat, spot.lng);
                }}
                className="shrink-0 rounded-full border border-stone-200 bg-stone-50 hover:bg-stone-100 px-3 py-1 text-[11px] font-bold text-stone-700 transition cursor-pointer"
              >
                {spot.name}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={houseDetails}
            onChange={(e) => setHouseDetails(e.target.value)}
            placeholder="House / Flat No., Building Name, Landmark (Optional)"
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-medium text-stone-900 outline-none focus:border-[#EF4F5F] focus:bg-white"
          />

          {error && <p className="text-xs font-semibold text-[#EF4F5F]">{error}</p>}

          <button
            type="button"
            onClick={handleConfirm}
            className="w-full rounded-xl bg-[#EF4F5F] hover:bg-[#e03e4e] active:scale-[0.99] py-3.5 text-sm font-extrabold text-white shadow-lg shadow-[#EF4F5F]/25 transition cursor-pointer"
          >
            Confirm location
          </button>
        </div>
      </div>
    </div>
  );
}
