"use client";
import React, { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, Navigation, Check } from "lucide-react";
import { fetchWithTimeout as fetch } from "@/lib/browserRequest";
import { DELIVERY_CENTER, validCoords } from "@/lib/delivery";

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
  const [lat, setLat] = useState(
    validCoords(initialLat, initialLng) ? String(initialLat) : String(DELIVERY_CENTER.lat)
  );
  const [lng, setLng] = useState(
    validCoords(initialLat, initialLng) ? String(initialLng) : String(DELIVERY_CENTER.lng)
  );
  const [detectedArea, setDetectedArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reverseGeocode = (newLat: number, newLng: number) => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const r = await fetch(`/api/maps?action=geocode&lat=${newLat}&lng=${newLng}`);
        const d = await r.json();
        if (d.success && d.address) {
          setDetectedArea(d.address);
          setDetails((prev) => (!prev || prev.length < 10 ? d.address : prev));
        }
      } catch {}
    }, 450);
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
        });
        L.control.zoom({ position: "bottomright" }).addTo(instance);
        mapRef.current = instance;

        // Google Maps Standard Roadmap Tiles
        L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
          subdomains: ["0", "1", "2", "3"],
        }).addTo(instance);

        instance.on("moveend", () => {
          if (!instance) return;
          const c = instance.getCenter();
          setLat(c.lat.toFixed(6));
          setLng(c.lng.toFixed(6));
          reverseGeocode(c.lat, c.lng);
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
      if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
      instance?.remove();
      mapRef.current = null;
    };
  }, [open]);

  function locate() {
    if (!navigator.geolocation || !window.isSecureContext) {
      setMessage("Open the live HTTPS website on your phone to capture GPS.");
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
        mapRef.current?.setView([Number(newLat), Number(newLng)], 18, { animate: true });
        reverseGeocode(Number(newLat), Number(newLng));
        setBusy(false);
        setMessage("GPS pin locked! Drag map to fine-tune your exact gate/doorstep, then save.");
      },
      () => {
        setBusy(false);
        setMessage("Could not access phone GPS. Drag the map below to place the pin on your house.");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  async function save() {
    if (!lat.trim() || !lng.trim()) {
      setMessage("Move the map pin or tap 'Use Current GPS' first.");
      return;
    }
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
          deliveryAddress: details,
        }),
      });
      const d = await r.json();
      if (!d.success) throw Error(d.error);
      setMessage("Doorstep pin updated! Rider's route is now synced.");
      setOpen(false);
      onSaved();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save delivery pin.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-orange-200/80 bg-orange-50/50 p-3.5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
            <MapPin size={15} />
          </div>
          <div>
            <p className="text-xs font-black text-stone-900">
              {hasPin ? "Exact Doorstep Pin Saved" : "Doorstep GPS Pin Missing"}
            </p>
            <p className="text-[11px] text-stone-500">
              {hasPin
                ? "Rider is navigating to your pinned gate"
                : "Set your pin on Google Maps for fast doorstep delivery"}
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen((v) => !v)}
          className="rounded-xl bg-white border border-orange-200 hover:bg-orange-100/60 px-3 py-1.5 text-xs font-bold text-orange-700 shadow-2xs transition cursor-pointer"
        >
          {open ? "Close" : hasPin ? "Adjust Pin" : "Set Pin on Map"}
        </button>
      </div>

      {open && (
        <div className="space-y-3 pt-1">
          <div className="relative h-56 w-full overflow-hidden rounded-2xl border border-orange-200 bg-stone-100 shadow-inner">
            <div ref={mapContainerRef} className="h-full w-full z-0" />
            <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center">
              <div className="-translate-y-4 flex flex-col items-center">
                <div className="rounded-full bg-stone-900 px-2.5 py-0.5 text-[10px] font-black text-white shadow-md mb-1">
                  Move map to pin gate
                </div>
                <div className="text-3xl drop-shadow-md">📍</div>
              </div>
            </div>
          </div>

          {detectedArea && (
            <div className="rounded-xl bg-white border border-orange-200/80 px-3 py-2 text-[11px] text-stone-700">
              <strong className="text-orange-600">Detected Location: </strong>
              <span>{detectedArea}</span>
            </div>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={locate}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-orange-300 bg-white hover:bg-orange-50 p-2.5 text-xs font-black text-orange-700 shadow-2xs transition cursor-pointer"
          >
            <Navigation size={14} />
            <span>Use My Current GPS Location</span>
          </button>

          <label className="block text-xs font-bold text-stone-700">
            House / Flat No., Floor & Nearby Landmark
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-orange-200 bg-white p-2.5 text-xs font-medium text-stone-900 outline-none focus:border-orange-500"
              maxLength={500}
              placeholder="e.g. House 14, Near Sharma Medical, Gandhi Chowk"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-orange-600 hover:bg-orange-700 p-3 text-xs font-black text-white shadow-md transition cursor-pointer disabled:opacity-50"
          >
            <Check size={15} />
            <span>{busy ? "Saving Pin…" : "Confirm & Save Doorstep Pin"}</span>
          </button>
        </div>
      )}

      {message && (
        <p role="status" className="text-[11px] font-semibold text-orange-800 bg-orange-100/70 px-3 py-1.5 rounded-xl">
          {message}
        </p>
      )}
    </div>
  );
}
