"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Polygon } from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, CheckCircle2, ArrowLeft } from "lucide-react";
import { fetchWithTimeout as fetch } from "@/lib/browserRequest";
import { DELIVERY_CENTER, validCoords } from "@/lib/delivery";
import { browserReverseGeocode } from "@/lib/googleMapsBrowser";

export default function OrderDeliveryPin({
  orderId,
  address,
  hasPin,
  initialLat,
  initialLng,
  onSaved,
}: {
  orderId: string;
  address: string;
  hasPin: boolean;
  initialLat?: number;
  initialLng?: number;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(address);
  const [placeTitle, setPlaceTitle] = useState(
    address?.split(",")[0]?.trim() || "Gandhi Chowk"
  );
  const [lat, setLat] = useState(
    validCoords(initialLat, initialLng) ? String(initialLat) : String(DELIVERY_CENTER.lat)
  );
  const [lng, setLng] = useState(
    validCoords(initialLat, initialLng) ? String(initialLng) : String(DELIVERY_CENTER.lng)
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
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
        const res = await browserReverseGeocode(newLat, newLng);
        setPlaceTitle(res.placeTitle || "Selected Location");
        setDetails(res.fullAddress);
      } catch {}
    }, 280);
  };

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let instance: LeafletMap | undefined;

    (async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || !mapContainerRef.current) return;
        const startLat = Number(lat) || DELIVERY_CENTER.lat;
        const startLng = Number(lng) || DELIVERY_CENTER.lng;

        instance = L.map(mapContainerRef.current, {
          center: [startLat, startLng],
          zoom: 17,
          zoomControl: false,
          attributionControl: false,
        });
        mapRef.current = instance;

        L.tileLayer("https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
        }).addTo(instance);

        // Zomato-style Blue POI Polygon around the selected location
        polygonRef.current = L.polygon([], {
          color: "#3b82f6",
          weight: 2,
          fillColor: "#60a5fa",
          fillOpacity: 0.24,
        }).addTo(instance);
        updatePolygon(startLat, startLng);

        setTimeout(() => {
          if (!cancelled && instance) instance.invalidateSize({ pan: false });
        }, 120);

        instance.on("move", () => {
          if (!instance) return;
          const c = instance.getCenter();
          updatePolygon(c.lat, c.lng);
        });

        instance.on("click", (e: any) => {
          if (!instance || !e?.latlng) return;
          instance.panTo(e.latlng, { animate: true });
        });

        instance.on("moveend", () => {
          if (!instance) return;
          const c = instance.getCenter();
          setLat(c.lat.toFixed(6));
          setLng(c.lng.toFixed(6));
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

  function locate() {
    if (!navigator.geolocation || !window.isSecureContext) {
      setMessage("Open the HTTPS website on your phone to capture GPS.");
      return;
    }
    setBusy(true);
    setMessage("Detecting your current GPS location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const newLat = p.coords.latitude.toFixed(6);
        const newLng = p.coords.longitude.toFixed(6);
        setLat(newLat);
        setLng(newLng);
        mapRef.current?.setView([Number(newLat), Number(newLng)], 17, { animate: true });
        updatePolygon(Number(newLat), Number(newLng));
        reverseGeocode(Number(newLat), Number(newLng));
        setBusy(false);
        setMessage("");
      },
      () => {
        setBusy(false);
        setMessage("Drag the map to place the pin on your exact building/gate.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function save() {
    setBusy(true);
    try {
      const r = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          action: "delivery-pin",
          deliveryLat: Number(lat),
          deliveryLng: Number(lng),
          deliveryAddress: details.trim().length >= 8 ? details : `${placeTitle}, ${details}, Ambikapur`,
        }),
      });
      const d = await r.json();
      if (!d.success) throw Error(d.error);
      setMessage("Location confirmed!");
      setOpen(false);
      onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save delivery location.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden shadow-xs">
      {/* Compact Zomato Summary Strip */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-start gap-2.5 min-w-0">
          <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              YOUR LOCATION
            </span>
            <p className="text-xs font-extrabold text-stone-900 truncate">
              {placeTitle}
            </p>
            <p className="text-[11px] text-stone-500 truncate">{details}</p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          className="text-xs font-extrabold text-[#EF4F5F] hover:opacity-80 uppercase tracking-wide shrink-0 cursor-pointer"
        >
          {open ? "CLOSE" : "CHANGE"}
        </button>
      </div>

      {/* Full Zomato "Select delivery location" Drawer */}
      {open && (
        <div className="border-t border-stone-100">
          {/* Interactive Map Area with Black Pill Pin & Blue Polygon */}
          <div className="relative w-full bg-[#e8ede5]" style={{ height: "280px" }}>
            <div ref={mapContainerRef} style={{ width: "100%", height: "280px" }} />

            {/* Top-Left Back Button */}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute left-3 top-3 z-[800] flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-800 shadow-md hover:bg-stone-50 cursor-pointer"
            >
              <ArrowLeft size={16} />
            </button>

            {/* Center Zomato Black Pill Pin */}
            <div className="pointer-events-none absolute inset-0 z-[700] flex items-center justify-center">
              <div className="-translate-y-5 flex flex-col items-center">
                <div className="rounded-full bg-stone-900 px-3.5 py-1.5 text-xs font-extrabold text-white shadow-lg whitespace-nowrap max-w-[220px] truncate">
                  {placeTitle}
                </div>
                <div className="h-3 w-0.5 bg-stone-900" />
                <div className="h-3.5 w-3.5 rounded-full bg-stone-900 border-2 border-white shadow-md" />
              </div>
            </div>

            {/* Bottom-Left Google Watermark */}
            <div className="pointer-events-none absolute bottom-2.5 left-3 z-[800] select-none font-sans text-sm font-black tracking-tight text-stone-700 drop-shadow-[0_1px_2px_rgba(255,255,255,0.95)]">
              Google
            </div>

            {/* Bottom-Right GPS Target Crosshair Button */}
            <button
              type="button"
              disabled={busy}
              onClick={locate}
              title="Use my current GPS"
              className="absolute bottom-3 right-3 z-[800] flex h-10 w-10 items-center justify-center rounded-full bg-white text-stone-900 shadow-lg border border-stone-200 hover:bg-stone-50 active:scale-95 transition cursor-pointer"
            >
              <LocateFixed size={18} />
            </button>
          </div>

          {/* Bottom White Sheet (Exact Zomato Screenshot 2 Layout) */}
          <div className="bg-white p-4 space-y-3.5">
            <h4 className="text-base font-extrabold text-stone-900">
              Select delivery location
            </h4>

            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
                YOUR LOCATION
              </span>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2 min-w-0">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <strong className="text-sm font-extrabold text-stone-900 block truncate">
                      {placeTitle}
                    </strong>
                    <span className="text-xs text-stone-500 block leading-snug">
                      {details}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={locate}
                  className="text-xs font-extrabold text-[#EF4F5F] uppercase shrink-0 cursor-pointer"
                >
                  GPS
                </button>
              </div>
            </div>

            <input
              type="text"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="House / Flat No., Floor, Building & Landmark"
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2.5 text-xs font-medium text-stone-900 outline-none focus:border-[#EF4F5F] focus:bg-white"
            />

            {message && (
              <p className="text-xs font-semibold text-[#EF4F5F]">{message}</p>
            )}

            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="w-full rounded-xl bg-[#EF4F5F] hover:bg-[#e03e4e] active:scale-[0.99] py-3.5 text-sm font-extrabold text-white shadow-md shadow-[#EF4F5F]/25 transition cursor-pointer disabled:opacity-50"
            >
              {busy ? "Confirming…" : "Confirm location"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
