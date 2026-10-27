"use client";
import { fetchWithTimeout as fetch } from "@/lib/browserRequest";

import BrandLogo from "@/components/BrandLogo";
import { shouldSyncRiderLocation } from "@/lib/riderGps";
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
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string;
}

export default function RiderDashboard() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [currentRiderName, setCurrentRiderName] = useState("Rider");
  const [liveOrders, setLiveOrders] = useState<RiderOrder[]>([]);
  const [cashCollected, setCashCollected] = useState(0);
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [skippedIds,setSkippedIds]=useState<string[]>([]);
  const [actionOrderId,setActionOrderId]=useState<string|null>(null);
  const actionLock=useRef(false);
  const pollInFlight=useRef(false);
  const pollSequence=useRef(0);
  const [ordersError,setOrdersError]=useState("");
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

  // Live GPS Tracking & Synchronization
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"active" | "denied" | "idle" | "requesting" | "error">("idle");
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [gpsMessage, setGpsMessage] = useState("");
  const applyGpsFix = (pos: GeolocationPosition) => {
    const lat = Number(pos.coords.latitude.toFixed(6));
    const lng = Number(pos.coords.longitude.toFixed(6));
    setGpsCoords({ lat, lng });
    setGpsStatus("active");
    setGpsEnabled(true);
    setIsOnline(true);
    setGpsMessage(`Live GPS active (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
    const activeOrder = ordersRef.current.find(
      (o) => o.riderId === userRef.current?.id && (o.status === "picked_up" || o.status === "rider_assigned")
    );
    if (activeOrder && !syncInFlightRef.current) {
      syncInFlightRef.current = true;
      fetch("/api/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: activeOrder.id, riderLat: lat, riderLng: lng }),
      })
        .then((r) => {
          if (r.ok) {
            lastBroadcastRef.current = { lat, lng };
            lastBroadcastOrderRef.current = activeOrder.id;
            lastBroadcastAtRef.current = Date.now();
          }
        })
        .catch(() => {})
        .finally(() => {
          syncInFlightRef.current = false;
        });
    }
  };
  const startGps = () => {
    if (typeof window === "undefined" || !window.isSecureContext || !navigator.geolocation) {
      setGpsStatus("error");
      setGpsMessage("GPS needs HTTPS. Open the live website in your phone browser.");
      return;
    }
    setGpsEnabled(true);
    setGpsStatus((prev) => (prev === "active" ? "active" : "requesting"));
    setGpsMessage("Locking live phone GPS…");
    navigator.geolocation.getCurrentPosition(
      applyGpsFix,
      (err) => {
        if (err.code === 1) {
          setGpsStatus("denied");
          setGpsMessage("Location is blocked. Allow Location in browser site settings, then tap Retry GPS.");
          return;
        }
        // Fallback to network/fused location if satellite high-accuracy times out indoors
        navigator.geolocation.getCurrentPosition(
          applyGpsFix,
          (err2) => {
            if (!gpsCoords) {
              setGpsStatus(err2.code === 1 ? "denied" : "error");
              setGpsMessage("Could not get a GPS fix. Turn on phone Location and tap Retry GPS.");
            }
          },
          { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 3000 }
    );
  };
  const lastBroadcastRef = useRef<{ lat: number; lng: number } | null>(null);
  const syncInFlightRef = useRef(false);
  const lastBroadcastAtRef = useRef(0);
  const lastBroadcastOrderRef = useRef<string | null>(null);
  const ordersRef = useRef<RiderOrder[]>([]);
  const userRef = useRef<any>(null);

  // Start continuous tracking only after the rider explicitly enables GPS.
  useEffect(() => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      setGpsStatus("error");
      return;
    }

    if (!isOnline) {setGpsStatus("idle");return;}
    if (!gpsEnabled) return;

    startGps();
    let watchId: number | undefined;
    try {
      watchId = navigator.geolocation.watchPosition(
        applyGpsFix,
        (err) => {
          if (err.code === 1) {
            setGpsStatus("denied");
            setGpsMessage("Location access was blocked. Allow Location in browser site settings, then retry.");
          }
        },
        { enableHighAccuracy: true, maximumAge: 2500, timeout: 12000 }
      );
    } catch (e) {}

    const heartbeat = setInterval(() => {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(
        applyGpsFix,
        () => {
          navigator.geolocation.getCurrentPosition(applyGpsFix, () => {}, {
            enableHighAccuracy: false,
            maximumAge: 15000,
            timeout: 8000,
          });
        },
        { enableHighAccuracy: true, maximumAge: 2500, timeout: 6000 }
      );
    }, 4000);

    return () => {
      clearInterval(heartbeat);
      if (watchId !== undefined && navigator.geolocation?.clearWatch) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [isOnline, gpsEnabled]);

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
    if(pollInFlight.current)return;
    pollInFlight.current=true;const sequence=++pollSequence.current;
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if(!res.ok || !data.success)throw Error(data.error || "Orders unavailable");
      if (data.orders && sequence===pollSequence.current) {
        setOrdersError("");setLiveOrders(data.orders);

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
      if(sequence===pollSequence.current)setOrdersError("Orders could not refresh. Check your connection and retry.");
    } finally {pollInFlight.current=false;}
  };

  useEffect(() => {
    fetchRiderOrders();
    const interval = setInterval(fetchRiderOrders, 3000);
    return () => {clearInterval(interval);pollSequence.current++;};
  }, [soundEnabled]);

  // Filter 1: Radar Orders (Available to pick up in Ambikapur)
  const radarOrders = liveOrders.filter((o) => {
    if (!isOnline || skippedIds.includes(o.id)) return false;
    // Food is ready at kitchen OR unassigned
    return o.status === "ready" && !o.riderId;
  });

  ordersRef.current = liveOrders;
  useEffect(() => {
    if(!isOnline || !gpsEnabled || gpsStatus!=="active" || !gpsCoords || syncInFlightRef.current)return;
    const activeOrder=liveOrders.find(o=>o.riderId===userRef.current?.id && (o.status==="picked_up" || o.status==="rider_assigned"));
    if(!activeOrder || !shouldSyncRiderLocation(lastBroadcastRef.current,gpsCoords,lastBroadcastOrderRef.current,activeOrder.id,lastBroadcastAtRef.current))return;
    const point={...gpsCoords};syncInFlightRef.current=true;
    fetch("/api/orders",{method:"PATCH",headers:{"Content-Type":"application/json"},signal:AbortSignal.timeout(15000),body:JSON.stringify({orderId:activeOrder.id,riderLat:point.lat,riderLng:point.lng})})
      .then(response=>{if(!response.ok)throw Error("Location sync failed");lastBroadcastRef.current=point;lastBroadcastOrderRef.current=activeOrder.id;lastBroadcastAtRef.current=Date.now();})
      .catch(()=>setGpsMessage("GPS is available, but location sync failed. Check your connection; the next update will retry."))
      .finally(()=>{syncInFlightRef.current=false;});
  },[liveOrders,gpsCoords,gpsStatus,gpsEnabled,isOnline]);

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
      setStatusMessage("Resuming your existing assigned delivery.");
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

  const handleTaskAction=async(orderId:string,pickup=false)=>{
    if(actionLock.current)return;
    if(!isOnline){setStatusMessage("Go online before accepting a task.");return;}
    if(!pickup && myActiveOrders.length){setStatusMessage("Complete your active delivery before accepting another task.");return;}
    actionLock.current=true;setActionOrderId(orderId);pollSequence.current++;
    setStatusMessage(pickup?"Confirming pickup…":"Accepting task…");
    try{
      const res=await fetch("/api/orders",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(pickup?{orderId,status:"picked_up"}:{orderId,action:"accept"})});
      const data=await res.json();if(!res.ok || !data.success)throw Error(data.error || "Could not update this task.");
      pollSequence.current++;
      hasAutoSwitched.current=true;
      setLiveOrders(prev=>[data.order,...prev.filter(o=>o.id!==orderId)]);setActiveTab("active");
      startGps();
      if (gpsCoords) {
        fetch("/api/orders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, riderLat: gpsCoords.lat, riderLng: gpsCoords.lng }),
        }).catch(() => {});
      }
      setStatusMessage(pickup?"Pickup confirmed. Navigate to the customer's saved pin.":"Task accepted. Go to the restaurant, then confirm pickup.");
    }catch(e){setStatusMessage(e instanceof Error?e.message:"Connection failed. Refresh to check the task before retrying.");}
    finally{actionLock.current=false;setActionOrderId(null);fetchRiderOrders();}
  };
  const handleAcceptOrder=(orderId:string)=>handleTaskAction(orderId);
  const handleRejectOrder=(orderId:string)=>{setSkippedIds(ids=>[...ids,orderId]);setStatusMessage("Task hidden from your radar. It remains available to other riders.");};

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
    <div className="h-full min-h-0 bg-[#FAF7F2] text-stone-900 flex justify-center items-stretch font-sans antialiased selection:bg-orange-500 selection:text-white">
      {/* Responsive rider workspace */}
      <div className="w-full max-w-3xl h-full min-h-0 bg-[#FAF7F2] text-stone-900 flex flex-col relative border-x border-stone-200 overflow-hidden">
        {/* Top App Header */}
        <header className="bg-white px-5 py-3.5 border-b border-[#EDE5DA] flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div>
            <div className="flex items-center gap-1.5">
              <BrandLogo size={48} />
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
                {gpsStatus === "active" ? "GPS: LIVE" : gpsStatus === "requesting" ? "GPS: REQUESTING" : gpsStatus === "denied" ? "GPS: BLOCKED" : "GPS: OFF"}
              </span>
              <button type="button" disabled={gpsStatus === "requesting"} onClick={startGps} className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[10px] font-bold text-orange-700 disabled:opacity-50">{gpsStatus === "requesting" ? "Finding GPS…" : gpsStatus === "active" ? "Refresh GPS" : gpsStatus === "denied" || gpsStatus === "error" ? "Retry GPS" : "Enable GPS"}</button>
            </div>
            {gpsMessage && <p role="status" className="mt-2 max-w-md text-xs text-stone-600">{gpsMessage}</p>}
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
        <main className="min-h-0 flex-1 p-4 overflow-y-auto space-y-4 pb-28">
        {ordersError&&<p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{ordersError} <button onClick={fetchRiderOrders} className="font-bold underline">Retry</button></p>}

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
                            {order.pickupAddress || "Pickup address not configured"}
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
                        Available until another rider accepts
                      </span>
                    </div>

                    {/* Dual Action Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        disabled={!!actionOrderId}
                        onClick={() => handleRejectOrder(order.id)}
                        className="py-3 px-3 rounded-2xl border border-[#E5DDD2] bg-white hover:bg-stone-50 text-stone-600 font-bold text-xs transition cursor-pointer"
                      >
                        Pass
                      </button>
                      <button
                        disabled={!!actionOrderId || !isOnline || myActiveOrders.length>0}
                        onClick={() => handleAcceptOrder(order.id)}
                        className="col-span-2 py-3 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs shadow-lg shadow-orange-500/20 hover:shadow-xl transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>{actionOrderId===order.id ? "ACCEPTING…" : myActiveOrders.length ? "Finish your active task first" : "ACCEPT TASK"}</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-white rounded-3xl p-8 border border-[#EDE5DA] text-center space-y-3 shadow-xs">
                  <div className="w-14 h-14 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center mx-auto shadow-inner">
                    <Bike className="w-7 h-7" />
                  </div>
                  <h4 className="font-black text-stone-900 text-base">{isOnline?"Radar scanning":"You are offline"}</h4>
                  <p className="text-xs text-stone-500 max-w-xs mx-auto leading-relaxed">
                    {isOnline?"Ready orders will appear here. Accept a task manually to reserve it.":"Go online to see available pickup tasks."}
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
                        {order.status==="rider_assigned" ? "Awaiting pickup" : "In transit"} • {order.orderNumber}
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
                          <span>{order.status==="rider_assigned" ? "Route to pickup" : "Route to customer"}</span>
                        </span>
                        <span className="text-[10px] text-stone-400 font-bold">OpenStreetMap</span>
                      </div>
                      <AmbikapurDeliveryMap
                        mode="rider"
                        restaurantName={order.restaurantName}
                        customerArea={order.deliveryArea}
                        orderNumber={order.orderNumber}
                        riderLocationUpdatedAt={gpsCoords ? new Date().toISOString() : undefined}
                        riderLat={gpsCoords?.lat ?? order.riderLat}
                        riderLng={gpsCoords?.lng ?? order.riderLng}
                        restaurantLat={order.pickupLat}
                        restaurantLng={order.pickupLng}
                        destination={order.status==="rider_assigned" ? "pickup" : "drop"}
                        customerLat={order.deliveryLat}
                        customerLng={order.deliveryLng}
                        height="320px"
                      />
                    </div>

                    {/* Navigation External GPS Button */}
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.status==="rider_assigned" ? (order.pickupLat!=null && order.pickupLng!=null ? `${order.pickupLat},${order.pickupLng}` : order.pickupAddress || order.restaurantName+", Ambikapur") : (order.deliveryLat!=null && order.deliveryLng!=null ? `${order.deliveryLat},${order.deliveryLng}` : order.deliveryArea))}&travelmode=driving&dir_action=navigate`}

                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl border border-[#E5DDD2] bg-white hover:bg-stone-50 text-stone-900 font-bold text-xs flex items-center justify-center gap-2 transition"
                    >
                      <Navigation className="w-4 h-4 text-orange-600" />
                      <span>Open in Google Maps App (Turn-by-turn Voice)</span>
                    </a>

                    {order.status==="rider_assigned" ? <button disabled={!!actionOrderId} onClick={()=>handleTaskAction(order.id,true)} className="w-full rounded-2xl bg-orange-600 p-4 text-sm font-bold text-white disabled:opacity-50">{actionOrderId===order.id?"Confirming…":"I have collected the food — confirm pickup"}</button> : (
                    <button
                      onClick={() => openPinModal(order)}
                      className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs shadow-lg shadow-orange-500/25 hover:shadow-xl transition active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <KeyRound className="w-4 h-4" />
                      <span>Deliver Food • Enter Customer PIN</span>
                    </button>
                    )}

                  </div>
                ))
              ) : (
                <div className="bg-white rounded-3xl p-6 border border-[#EDE5DA] text-center space-y-4 shadow-xs">
                  <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-orange-50"><Navigation className="h-9 w-9 text-orange-600"/></div>
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
