"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ToggleRight,
  ToggleLeft,
  MapPin,
  Navigation,
  Banknote,
  Phone,
  Clock,
  ShieldAlert,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Check,
  X,
  RefreshCw,
  Bike,
  LogOut,
  Lock,
  Volume2,
  VolumeX,
  KeyRound,
  Coins,
  Store,
  User,
  ExternalLink,
  Flame,
  CheckCheck,
} from "lucide-react";
import AmbikapurDeliveryMap from "@/components/AmbikapurDeliveryMap";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
  isVeg?: boolean;
}

interface RiderOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryArea: string;
  restaurantName: string;
  items: OrderItem[];
  itemTotal: number;
  deliveryFee: number;
  platformFee: number;
  totalAmount: number;
  paymentMethod: "COD" | "UPI";
  paymentStatus: "pending" | "completed";
  status: "placed" | "preparing" | "ready" | "rider_assigned" | "picked_up" | "delivered" | "cancelled";
  riderName: string | null;
  riderId?: string | null;
  createdAt: string;
  prepTimeMinutes: number;
  deliveryPin: string;
  distanceKm: number;
  riderEarnings: number;
  riderLat?: number;
  riderLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
}

export default function RiderDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [currentRiderName, setCurrentRiderName] = useState("Rider");
  const [liveOrders, setLiveOrders] = useState<RiderOrder[]>([]);
  const [cashCollected, setCashCollected] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"radar" | "active" | "wallet">("radar");

  // Audio Service Bell states
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previousPendingCount = useRef(0);

  // Doorstep PIN Verification Modal states
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [activeDeliveryOrder, setActiveDeliveryOrder] = useState<RiderOrder | null>(null);
  const [enteredPin, setEnteredPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [deliverySuccess, setDeliverySuccess] = useState(false);

  // Acceptance Timer per order (countdown from 30s)
  const [timerSeconds, setTimerSeconds] = useState(30);

  // Live GPS Tracking & Synchronization
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"active" | "simulated" | "denied">("simulated");
  const lastBroadcastRef = useRef<{ lat: number; lng: number } | null>(null);
  const ordersRef = useRef<RiderOrder[]>([]);
  const userRef = useRef<any>(null);
  const [simIndex, setSimIndex] = useState(0);

  // Ambikapur road corridor coordinates along actual streets (OSRM)
  const ambikapurCorridor: [number, number][] = [
    [23.12341, 83.1933],  // 1. Gandhi Chowk (Pickup)
    [23.12437, 83.19503], // 2. Main Market Road
    [23.12295, 83.19799], // 3. Clock Tower Junction
    [23.12091, 83.20262], // 4. Hospital Road
    [23.11801, 83.20313], // 5. Ring Road South
    [23.11559, 83.20455], // 6. Kedarpur (Customer Drop)
  ];

  // Automatic GPS Watcher (Requests permission automatically on load)
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus("simulated");
      return;
    }

    if (!isOnline) return;

    let watchId: number;
    try {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          setGpsCoords({ lat, lng });
          setGpsStatus("active");

          // Broadcast to active task if moved
          const prev = lastBroadcastRef.current;
          if (prev && Math.abs(prev.lat - lat) < 0.0001 && Math.abs(prev.lng - lng) < 0.0001) {
            return;
          }
          lastBroadcastRef.current = { lat, lng };

          // Broadcast GPS strictly to orders assigned to THIS rider (by ID only)
          const activeOrder = ordersRef.current.find(
            (o) =>
              !!userRef.current?.id &&
              o.riderId === userRef.current.id &&
              (o.status === "picked_up" || o.status === "rider_assigned")
          );

          if (activeOrder) {
            fetch("/api/orders", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                orderId: activeOrder.id,
                riderLat: lat,
                riderLng: lng,
              }),
            }).catch(() => {});
          }
        },
        (err) => {
          console.log("GPS Notice:", err.message);
          setGpsStatus(err.code === 1 ? "denied" : "simulated");
        },
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 10000 }
      );
    } catch (e) {
      setGpsStatus("simulated");
    }

    return () => {
      if (watchId !== undefined && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOnline]);

  // Demo step mover for testing live synchronization on laptop
  const advanceRiderLocation = async (orderId: string) => {
    const nextIdx = (simIndex + 1) % ambikapurCorridor.length;
    setSimIndex(nextIdx);
    const [lat, lng] = ambikapurCorridor[nextIdx];
    setGpsCoords({ lat, lng });
    setGpsStatus("simulated");

    setStatusMessage("Demo location only. Real customer tracking is unchanged.");
  };

  // Initialize Audio
  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/service-bell.mp3");
      audioRef.current.volume = 0.8;
    }
  }, []);

  const playBellChime = () => {
    if (!soundEnabled || !audioRef.current) return;
    try {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch((err) => {
        console.warn("Autoplay notice: User interaction needed before audio can play.", err);
      });
    } catch (e) {}
  };

  // Check authenticated rider session
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.authenticated && data.user) {
          if (data.user.role === "rider" || data.user.role === "admin") {
            setCurrentUser(data.user);
            setCurrentRiderName(data.user.name || "Rider Partner");
          }
        }
      })
      .catch(() => {});
  }, [router]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/rider/login");
  };

  // Poll orders every 3 seconds for real-time radar sync
  const fetchRiderOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.success && data.orders) {
        setLiveOrders(data.orders);

        // Filter pending ready orders
        const pendingCount = data.orders.filter(
          (o: RiderOrder) => o.status === "ready" || (o.status === "rider_assigned" && !o.riderName)
        ).length;

        // If new orders arrived, trigger bell chime
        if (pendingCount > previousPendingCount.current && pendingCount > 0) {
          playBellChime();
        }
        previousPendingCount.current = pendingCount;
      }
    } catch (e) {
      console.warn("Rider orders fetch error:", e);
    }
  };

  useEffect(() => {
    fetchRiderOrders();
    const interval = setInterval(fetchRiderOrders, 3000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  // Acceptance Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimerSeconds((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter 1: Radar Orders (Available to pick up in Ambikapur)
  const radarOrders = liveOrders.filter((o) => {
    if (o.status === "delivered" || o.status === "cancelled") return false;
    // Food is ready at kitchen OR unassigned
    return o.status === "ready" || (o.status === "rider_assigned" && !o.riderName);
  });

  ordersRef.current = liveOrders;
  userRef.current = currentUser;

  // Filter 2: My Active Deliveries — matched ONLY by rider ID from the server,
  // so it survives logout / relogin / phone crash / switching devices.
  const myActiveOrders = liveOrders.filter(
    (o) =>
      !!currentUser?.id &&
      o.riderId === currentUser.id &&
      (o.status === "picked_up" || o.status === "rider_assigned")
  );

  // Auto-resume active delivery if phone glitched or rider logged back in
  const hasAutoSwitched = useRef(false);
  useEffect(() => {
    if (!hasAutoSwitched.current && myActiveOrders.length > 0) {
      setActiveTab("active");
      hasAutoSwitched.current = true;
    }
  }, [myActiveOrders.length]);

  // Filter 3: My completed deliveries (real totals, not hardcoded)
  const completedOrders = liveOrders.filter(
    (o) => o.status === "delivered" && !!currentUser?.id && o.riderId === currentUser.id
  );

  useEffect(() => {
    const today = new Date().toDateString();
    const doneToday = completedOrders.filter((o) => new Date(o.createdAt).toDateString() === today);
    setCashCollected(
      doneToday.filter((o) => o.paymentMethod === "COD").reduce((s, o) => s + (o.totalAmount || 0), 0)
    );
    setTodayEarnings(doneToday.reduce((s, o) => s + (o.riderEarnings || 0), 0));
  }, [liveOrders, currentUser]);

  // Accept Order from Radar — server decides the winner (first come, first served)
  const handleAcceptOrder = async (orderId: string) => {
    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status: "picked_up" }),
      });
      const data = await res.json();
      if (data.success) {
        setStatusMessage("✅ Task Locked! Head to restaurant for pickup.");
        playBellChime();
        fetchRiderOrders();
        setActiveTab("active");
      } else {
        setStatusMessage(`⚠️ ${data.error || "Could not accept this order."}`);
        fetchRiderOrders();
      }
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (e) {
      console.error(e);
      setStatusMessage("⚠️ Network error, try again.");
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Reject / Pass Order
  const handleRejectOrder = (orderId: string) => {
    setStatusMessage("Order skipped. Loading next radar task...");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  // Open Doorstep Handshake Modal
  const openPinModal = (order: RiderOrder) => {
    setActiveDeliveryOrder(order);
    setEnteredPin("");
    setPinError(null);
    setDeliverySuccess(false);
    setIsPinModalOpen(true);
  };

  // Keypad Handlers
  const handleKeypadPress = (digit: string) => {
    if (enteredPin.length < 4) {
      setEnteredPin((prev) => prev + digit);
      setPinError(null);
    }
  };

  const handleKeypadBackspace = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    setPinError(null);
  };

  // Submit PIN for Doorstep Verification
  const handleVerifyAndDeliver = async () => {
    if (enteredPin.length !== 4) {
      setPinError("Please enter the complete 4-digit PIN.");
      return;
    }

    if (!activeDeliveryOrder) return;

    setIsVerifyingPin(true);
    setPinError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: activeDeliveryOrder.id,
          status: "delivered",
          submittedPin: enteredPin,
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (typeof window !== "undefined") {
          localStorage.removeItem("zuppo_active_rider_order");
        }
        setDeliverySuccess(true);
        setCashCollected((c) =>
          activeDeliveryOrder.paymentMethod === "COD" ? c + activeDeliveryOrder.totalAmount : c
        );
        setTodayEarnings((e) => e + (activeDeliveryOrder.riderEarnings || 38));
        playBellChime();

        setTimeout(() => {
          setIsPinModalOpen(false);
          setActiveDeliveryOrder(null);
          setDeliverySuccess(false);
          fetchRiderOrders();
          setActiveTab("wallet");
        }, 1500);
      } else {
        setPinError(data.error || "Incorrect PIN! Please ask customer for the 4-digit PIN.");
      }
    } catch (err: any) {
      setPinError("Network error: " + err.message);
    } finally {
      setIsVerifyingPin(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-900 flex justify-center items-start sm:py-6 font-sans antialiased selection:bg-orange-500 selection:text-white">
      {/* Mobile Device Simulation Shell */}
      <div className="w-full max-w-md bg-[#FAF7F2] text-stone-900 min-h-screen sm:min-h-[850px] sm:rounded-[40px] flex flex-col relative shadow-2xl sm:border-[8px] sm:border-stone-800 overflow-hidden">
        {/* Dynamic Island / Speaker cutout simulation */}
        <div className="hidden sm:flex justify-center pt-2.5 pb-1 bg-white">
          <div className="w-24 h-4 bg-stone-900 rounded-full" />
        </div>

        {/* Top App Header */}
        <header className="bg-white px-5 py-3.5 border-b border-[#EDE5DA] flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-black text-stone-900 text-lg tracking-tight">
                zuppo<span className="text-orange-600">.</span>
              </span>
              <span className="bg-orange-100 text-orange-700 text-[10px] font-black uppercase px-2 py-0.5 rounded-full border border-orange-200">
                Rider Fleet
              </span>
            </div>

            <div className="flex items-center gap-2 mt-0.5">
              <div className="flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? "bg-emerald-500 animate-pulse" : "bg-stone-300"
                  }`}
                />
                <span className="text-[11px] font-bold text-stone-700">
                  {currentRiderName}
                </span>
              </div>
              <span
                className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                  gpsStatus === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                {gpsStatus === "active" ? "🛰️ GPS: LIVE" : "📍 GPS: AUTO"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Audio Service Bell Toggle */}
            <button
              onClick={() => {
                setSoundEnabled(!soundEnabled);
                playBellChime();
              }}
              className={`p-2 rounded-xl border transition cursor-pointer ${
                soundEnabled
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "bg-stone-100 border-stone-200 text-stone-400"
              }`}
              title={soundEnabled ? "Order Bell: Active" : "Order Bell: Muted"}
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            {/* Online / Offline Toggle */}
            <button
              onClick={() => setIsOnline(!isOnline)}
              className="transition active:scale-90 cursor-pointer"
              title={isOnline ? "You are Online" : "You are Offline"}
            >
              {isOnline ? (
                <ToggleRight className="w-9 h-9 text-emerald-600" />
              ) : (
                <ToggleLeft className="w-9 h-9 text-stone-300" />
              )}
            </button>

            <button
              onClick={handleLogout}
              className="p-2 text-stone-400 hover:text-rose-600 bg-stone-100 rounded-xl transition cursor-pointer"
              title="Logout"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {/* Status Notification Toast */}
        {statusMessage && (
          <div className="bg-stone-900 text-white text-xs font-bold px-4 py-2.5 mx-4 mt-3 rounded-2xl shadow-lg flex items-center gap-2 animate-in slide-in-from-top-2 z-20">
            <Sparkles className="w-4 h-4 text-orange-400 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* Scrollable Tasks Body */}
        <main className="flex-1 p-4 overflow-y-auto space-y-4 pb-28">
          {/* COD Cash Holding Banner */}
          <div
            className={`rounded-2xl p-3 border flex items-start gap-2.5 text-xs shadow-xs ${
              cashCollected >= 1600
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : "bg-amber-50/80 border-amber-200 text-amber-900"
            }`}
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-bold">COD Cash in Pocket: ₹{cashCollected}</span>
                <span className="text-[10px] font-black uppercase text-amber-700">Max ₹2,000</span>
              </div>
              <p className="text-[10px] text-stone-600 mt-0.5">
                {cashCollected >= 1600
                  ? "Approaching limit! Handover cash to Hub/Admin to keep receiving orders."
                  : "Safe floating cash balance. Settle with admin at end of shift."}
              </p>
            </div>
          </div>

          {/* TAB 1: RADAR (BROADCAST ORDERS POOL - 10 to 25 ORDERS) */}
          {activeTab === "radar" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-orange-600 animate-ping" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-stone-900">
                    Live Dispatch Radar ({radarOrders.length})
                  </h3>
                </div>
                <button
                  onClick={fetchRiderOrders}
                  className="text-[11px] font-bold text-orange-600 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Refresh</span>
                </button>
              </div>

              {radarOrders.length > 0 ? (
                radarOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl p-5 border border-[#EDE5DA] shadow-[0_10px_25px_rgba(200,180,160,0.1)] space-y-4 relative overflow-hidden"
                  >
                    {/* 30-Second Acceptance Countdown Bar */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-stone-100">
                      <div
                        className="h-full bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-1000"
                        style={{ width: `${(timerSeconds / 30) * 100}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="bg-orange-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full shadow-xs">
                        {order.orderNumber}
                      </span>
                      <div className="flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-black">
                        <Coins className="w-3.5 h-3.5" />
                        <span>EARN ₹{order.riderEarnings || 38}.00</span>
                      </div>
                    </div>

                    {/* Route Details */}
                    <div className="space-y-2.5 text-xs">
                      {/* Restaurant Pickup */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 mt-0.5">
                          <Store className="w-3 h-3" />
                        </div>
                        <div>
                          <strong className="text-stone-900 block font-bold">
                            {order.restaurantName}
                          </strong>
                          <span className="text-[11px] text-stone-500">
                            Gandhi Chowk Main Market (0.8 km)
                          </span>
                        </div>
                      </div>

                      {/* Customer Drop */}
                      <div className="flex items-start gap-2.5">
                        <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                          <MapPin className="w-3 h-3" />
                        </div>
                        <div>
                          <strong className="text-stone-900 block font-bold">
                            {order.customerName}
                          </strong>
                          <span className="text-[11px] text-stone-500">
                            {order.deliveryArea} ({order.distanceKm || 2.1} km)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Order Items & Bill info */}
                    <div className="py-2.5 px-3 bg-[#FAF7F2] rounded-2xl border border-[#EDE5DA] flex items-center justify-between text-xs">
                      <span className="text-stone-600 font-medium">
                        {order.items.length} item{order.items.length > 1 ? "s" : ""} • Collect{" "}
                        <strong className="text-stone-900">₹{order.totalAmount}</strong> ({order.paymentMethod})
                      </span>
                      <span className="text-[10px] text-stone-400 font-bold">
                        {timerSeconds}s left
                      </span>
                    </div>

                    {/* Dual Action Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleRejectOrder(order.id)}
                        className="py-3 px-3 rounded-2xl border border-[#E5DDD2] bg-white hover:bg-stone-50 text-stone-600 font-bold text-xs transition cursor-pointer"
                      >
                        Pass
                      </button>
                      <button
                        onClick={() => handleAcceptOrder(order.id)}
                        className="col-span-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs shadow-lg shadow-orange-500/20 hover:shadow-xl transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>ACCEPT TASK (Earn ₹{order.riderEarnings || 38})</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-3xl p-8 border border-[#EDE5DA] text-center space-y-3 shadow-xs">
                  <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
                    <Bike className="w-7 h-7" />
                  </div>
                  <h4 className="font-black text-stone-900 text-base">Radar Scanning...</h4>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                    Searching for active kitchen dispatch in Ambikapur. Keep app open to receive alerts with bell ring.
                  </p>
                  <button
                    onClick={playBellChime}
                    className="text-[11px] font-bold text-stone-600 hover:text-stone-900 bg-stone-100 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                    <span>Test Order Bell Ring</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: ACTIVE DELIVERIES (IN TRANSIT) */}
          {activeTab === "active" && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-900">
                My Active Tasks ({myActiveOrders.length})
              </h3>

              {myActiveOrders.length > 0 ? (
                myActiveOrders.map((order) => (
                  <div
                    key={order.id}
                    className="bg-white rounded-3xl p-5 border border-orange-300 shadow-[0_15px_30px_rgba(255,100,0,0.08)] space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-stone-100">
                      <span className="bg-emerald-600 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full">
                        In Transit • {order.orderNumber}
                      </span>
                      <span className="text-xs font-bold text-stone-500">
                        {order.deliveryArea.split(",")[0]}
                      </span>
                    </div>

                    {/* Customer & Call Button */}
                    <div className="flex items-center justify-between p-3 bg-[#FAF7F2] rounded-2xl border border-[#EDE5DA]">
                      <div>
                        <strong className="text-stone-900 block text-xs font-bold">
                          {order.customerName}
                        </strong>
                        <span className="text-[11px] text-stone-500">{order.deliveryArea}</span>
                      </div>
                      <a
                        href={`tel:${order.customerPhone}`}
                        className="w-9 h-9 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-md hover:bg-emerald-700 transition"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    </div>

                    {/* Live OpenStreetMap Ambikapur Route */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-bold text-stone-600 px-1">
                        <span className="flex items-center gap-1.5">
                          <Navigation className="w-3.5 h-3.5 text-orange-600" />
                          <span>Customer Drop Route • {order.deliveryArea.split(",")[0]}</span>
                        </span>
                        <span className="text-[10px] text-stone-400 font-bold">OpenStreetMap</span>
                      </div>
                      <AmbikapurDeliveryMap
                        mode="rider"
                        restaurantName={order.restaurantName}
                        customerArea={order.deliveryArea}
                        orderNumber={order.orderNumber}
                        riderLocationUpdatedAt={gpsStatus === "active" ? new Date().toISOString() : undefined}
                        riderLat={gpsStatus === "active" ? gpsCoords?.lat : undefined}
                        riderLng={gpsStatus === "active" ? gpsCoords?.lng : undefined}
                        customerLat={order.deliveryLat}
                        customerLng={order.deliveryLng}
                        height="200px"
                      />
                    </div>

                    {/* Quick Demo Mover for testing on Laptop */}
                    <button
                      onClick={() => advanceRiderLocation(order.id)}
                      className="w-full py-2 px-3 rounded-xl border border-dashed border-orange-300 bg-orange-50/70 hover:bg-orange-100 text-orange-800 font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Bike className="w-3.5 h-3.5 text-orange-600" />
                      <span>Simulate Rider Step ({simIndex + 1}/5) • Syncs to Customer Screen</span>
                    </button>

                    {/* Navigation External GPS Button */}
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                        order.deliveryArea + ", Ambikapur"
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl border border-[#E5DDD2] bg-white hover:bg-stone-50 text-stone-900 font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Navigation className="w-4 h-4 text-orange-600" />
                      <span>Open in Google Maps App (Turn-by-turn Voice)</span>
                    </a>

                    {/* Big Action: Open Doorstep PIN Modal */}
                    <button
                      onClick={() => openPinModal(order)}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs shadow-lg shadow-orange-500/25 hover:shadow-xl transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Deliver Food • Enter Customer PIN</span>
                    </button>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-3xl p-6 border border-[#EDE5DA] text-center space-y-4 shadow-xs">
                  <div className="rounded-2xl overflow-hidden border border-[#EDE5DA]">
                    <AmbikapurDeliveryMap
                      mode="rider"
                      restaurantName="The Royal Kitchen"
                      customerArea="Kedarpur Residential Zone, Ambikapur"
                      orderNumber="READY"
                      height="180px"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">No Active Delivery in Transit</h4>
                    <p className="text-xs text-stone-500 mt-1">
                      You have not accepted an order yet. Switch to the <strong>Radar</strong> tab to accept pending food deliveries!
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab("radar")}
                    className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 text-white font-black text-xs shadow-md transition cursor-pointer"
                  >
                    View & Accept Radar Orders ({radarOrders.length}) ➔
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: WALLET & EARNINGS LEDGER */}
          {activeTab === "wallet" && (
            <div className="space-y-4">
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-900">
                Rider Wallet & Payouts
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-3xl border border-[#EDE5DA] shadow-xs">
                  <span className="text-[10px] font-black uppercase text-stone-400 block tracking-wider mb-1">
                    Today&apos;s Trip Pay
                  </span>
                  <h4 className="text-2xl font-black text-emerald-600">₹{todayEarnings}</h4>
                  <p className="text-[10px] text-stone-500 mt-0.5">
                    {completedOrders.length} trip{completedOrders.length > 1 ? "s" : ""} completed
                  </p>
                </div>

                <div className="bg-white p-4 rounded-3xl border border-[#EDE5DA] shadow-xs">
                  <span className="text-[10px] font-black uppercase text-stone-400 block tracking-wider mb-1">
                    Cash in Hand (COD)
                  </span>
                  <h4 className="text-2xl font-black text-stone-900">₹{cashCollected}</h4>
                  <p className="text-[10px] text-amber-600 font-bold mt-0.5">Handover due tonight</p>
                </div>
              </div>

              {/* Completed Deliveries List */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-stone-600 block">
                  Completed Deliveries Today:
                </span>
                {completedOrders.map((o) => (
                  <div
                    key={o.id}
                    className="p-3 bg-white rounded-2xl border border-[#EDE5DA] flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-stone-900 block font-bold">
                        {o.orderNumber} • {o.deliveryArea.split(",")[0]}
                      </strong>
                      <span className="text-[10px] text-stone-400">
                        {new Date(o.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} • PIN Verified
                      </span>
                    </div>
                    <span className="font-black text-emerald-600">+₹{o.riderEarnings || 38}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* ================= DOORSTEP DELIVERY PIN MODAL (RAPIDO/SWIGGY STYLE) ================= */}
        {isPinModalOpen && activeDeliveryOrder && (
          <div className="fixed inset-0 bg-stone-950/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
            <div className="bg-white w-full max-w-sm rounded-t-[32px] sm:rounded-3xl p-6 space-y-5 shadow-2xl border border-[#EDE5DA] animate-in slide-in-from-bottom-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-stone-900">Doorstep Verification</h4>
                    <p className="text-[10px] text-stone-500">{activeDeliveryOrder.orderNumber}</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPinModalOpen(false)}
                  className="p-1 rounded-full text-stone-400 hover:text-stone-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {deliverySuccess ? (
                <div className="py-6 text-center space-y-3 animate-in zoom-in-95">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
                    <CheckCheck className="w-8 h-8" />
                  </div>
                  <h4 className="text-lg font-black text-stone-900">Delivery Confirmed!</h4>
                  <p className="text-xs text-stone-600">
                    ₹{activeDeliveryOrder.riderEarnings || 38} credited to your Rider wallet!
                  </p>
                </div>
              ) : (
                <>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-bold text-stone-700">
                      Ask customer for the 4-Digit Delivery PIN
                    </p>
                    <p className="text-[11px] text-stone-400">
                      Shown on customer&apos;s live tracking screen in zuppo app
                    </p>
                  </div>

                  {/* 4 Digit Boxes */}
                  <div className="flex justify-center gap-3">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-12 h-14 rounded-2xl border-2 flex items-center justify-center font-mono font-black text-2xl transition-all ${
                          enteredPin[idx]
                            ? "border-orange-600 bg-orange-50/50 text-stone-900 shadow-sm"
                            : "border-[#E5DDD2] bg-[#FAF7F2] text-stone-400"
                        }`}
                      >
                        {enteredPin[idx] || "•"}
                      </div>
                    ))}
                  </div>

                  {/* Error Feedback */}
                  {pinError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold text-center">
                      {pinError}
                    </div>
                  )}

                  {/* Tactile Keypad */}
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "DEL"].map((k, i) => {
                      if (k === "") return <div key={i} />;
                      if (k === "DEL") {
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={handleKeypadBackspace}
                            className="h-12 rounded-2xl bg-stone-100 hover:bg-stone-200 font-bold text-xs text-stone-700 flex items-center justify-center transition active:scale-95 cursor-pointer"
                          >
                            Backspace
                          </button>
                        );
                      }
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleKeypadPress(k)}
                          className="h-12 rounded-2xl bg-[#FAF7F2] hover:bg-stone-100 border border-[#E5DDD2] font-black text-lg text-stone-900 flex items-center justify-center transition active:scale-95 cursor-pointer shadow-2xs"
                        >
                          {k}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleVerifyAndDeliver}
                    disabled={isVerifyingPin || enteredPin.length !== 4}
                    className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-40 text-white font-black text-xs shadow-lg shadow-orange-500/25 transition active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isVerifyingPin ? "Verifying with zuppo Engine..." : "Confirm & Complete Delivery"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bottom Tab Bar (Mobile) */}
        <div className="absolute bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-[#EDE5DA] px-6 py-3 flex items-center justify-around z-20 shadow-md">
          <button
            onClick={() => setActiveTab("radar")}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === "radar" ? "text-orange-600 font-black" : "text-stone-400 font-bold"
            }`}
          >
            <div className="relative">
              <Navigation className="w-5 h-5" />
              {radarOrders.length > 0 && (
                <span className="w-2 h-2 rounded-full bg-orange-600 absolute -top-0.5 -right-0.5 animate-ping" />
              )}
            </div>
            <span className="text-[10px]">Radar ({radarOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("active")}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === "active" ? "text-orange-600 font-black" : "text-stone-400 font-bold"
            }`}
          >
            <Bike className="w-5 h-5" />
            <span className="text-[10px]">Tasks ({myActiveOrders.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("wallet")}
            className={`flex flex-col items-center gap-1 transition cursor-pointer ${
              activeTab === "wallet" ? "text-orange-600 font-black" : "text-stone-400 font-bold"
            }`}
          >
            <Banknote className="w-5 h-5" />
            <span className="text-[10px]">Earnings</span>
          </button>
        </div>
      </div>
    </div>
  );
}
