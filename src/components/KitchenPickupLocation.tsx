"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Check } from "lucide-react";
import { fetchWithTimeout as fetch } from "@/lib/browserRequest";
import { DELIVERY_CENTER, validCoords } from "@/lib/delivery";

export default function KitchenPickupLocation({ restaurantId }: { restaurantId: string }) {
  const [lat, setLat] = useState(String(DELIVERY_CENTER.lat));
  const [lng, setLng] = useState(String(DELIVERY_CENTER.lng));
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/restaurants")
      .then((r) => r.json())
      .then((d) => {
        const row = d.restaurants?.find((r: { id: string }) => r.id === restaurantId);
        if (active && row && validCoords(Number(row.latitude), Number(row.longitude))) {
          setLat(String(row.latitude));
          setLng(String(row.longitude));
          mapRef.current?.setView([Number(row.latitude), Number(row.longitude)], 16);
        }
      })
      .catch(() => {
        if (active) setMessage("Could not load pickup pin.");
      });
    return () => {
      active = false;
    };
  }, [restaurantId]);

  useEffect(() => {
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
          zoom: 16,
          zoomControl: false,
        });
        L.control.zoom({ position: "bottomright" }).addTo(instance);
        mapRef.current = instance;

        L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
          subdomains: ["0", "1", "2", "3"],
        }).addTo(instance);

        instance.on("moveend", () => {
          if (!instance) return;
          const c = instance.getCenter();
          setLat(c.lat.toFixed(6));
          setLng(c.lng.toFixed(6));
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
      instance?.remove();
      mapRef.current = null;
    };
  }, []);

  function locate() {
    if (!navigator.geolocation || !window.isSecureContext) {
      setMessage("Open the HTTPS website on your phone to use GPS.");
      return;
    }
    setBusy(true);
    setMessage("Finding your restaurant location…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const newLat = p.coords.latitude.toFixed(6);
        const newLng = p.coords.longitude.toFixed(6);
        setLat(newLat);
        setLng(newLng);
        mapRef.current?.setView([Number(newLat), Number(newLng)], 17, { animate: true });
        setBusy(false);
        setMessage("GPS captured! Drag map to fine-tune your exact shop entrance, then click Save.");
      },
      () => {
        setBusy(false);
        setMessage("Could not access GPS. Drag the map above to pin your shop entrance.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function save() {
    if (!lat.trim() || !lng.trim()) {
      setMessage("Move the map pin or tap 'Use Restaurant GPS' first.");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/restaurants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: restaurantId, latitude: Number(lat), longitude: Number(lng) }),
      });
      const d = await r.json();
      if (!d.success) throw Error(d.error);
      setMessage("Restaurant pickup GPS pin saved! Riders will navigate here.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save pickup pin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3.5 rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-black text-white flex items-center gap-1.5">
            <MapPin size={15} className="text-orange-500" />
            <span>Restaurant Pickup GPS Pin</span>
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Drag map to place the pin at your kitchen entrance so riders arrive at the exact gate.
          </p>
        </div>
        <span className="rounded-lg bg-slate-900 border border-slate-800 px-2.5 py-1 text-[10px] font-mono text-slate-300">
          {Number(lat).toFixed(4)}, {Number(lng).toFixed(4)}
        </span>
      </div>

      {/* Interactive Pin Picker Map */}
      <div className="relative h-52 w-full overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
        <div ref={mapContainerRef} className="h-full w-full z-0" />
        <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
          <div className="-translate-y-4 flex flex-col items-center">
            <div className="rounded-full bg-orange-600 px-2.5 py-0.5 text-[10px] font-black text-white shadow-md mb-1">
              Kitchen Entrance
            </div>
            <div className="text-3xl drop-shadow-md">🏪</div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={busy}
          onClick={locate}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900 hover:bg-slate-800 px-3 py-2.5 text-xs font-bold text-white transition cursor-pointer"
        >
          <Navigation size={14} className="text-orange-400" />
          <span>Use Current GPS</span>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 px-4 py-2.5 text-xs font-black text-white shadow-md transition cursor-pointer disabled:opacity-50"
        >
          <Check size={14} />
          <span>{busy ? "Saving…" : "Save Pickup Pin"}</span>
        </button>
      </div>

      {message && (
        <p role="status" className="text-xs font-semibold text-orange-200 bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-xl">
          {message}
        </p>
      )}
    </section>
  );
}
