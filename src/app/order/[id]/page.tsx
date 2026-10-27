"use client";

import BrandLogo from "@/components/BrandLogo";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  CheckCircle2,
  Bike,
  Store,
  Phone,
  ShieldCheck,
  RefreshCw,
  MapPin,
  KeyRound,
  Receipt,
  Check,
  ShoppingBag,
  ChefHat,
  Navigation,
} from "lucide-react";
import OrderDeliveryPin from "@/components/OrderDeliveryPin";
import AmbikapurDeliveryMap from "@/components/AmbikapurDeliveryMap";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
  isVeg?: boolean;
}

interface OrderDetail {
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
  createdAt: string;
  prepTimeMinutes: number;
  deliveryPin: string;
  distanceKm: number;
  riderEarnings: number;
  riderLocationUpdatedAt?: string;
  riderLat?: number;
  riderLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  pickupLat?: number;
  pickupLng?: number;
  pickupAddress?: string;
  restaurantPhone?: string;
}

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = (params?.id as string) || "demo-ord-1";

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRegeneratingPin, setIsRegeneratingPin] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);

  // Poll order status every 3 seconds for live updates
  const fetchOrder = async () => {
    try {
      const res = await fetch(`/api/orders?id=${encodeURIComponent(orderId)}`);
      if (res.status === 401) {
        router.replace("/login?role=customer");
        return;
      }
      const data = await res.json();
      if (data.success && data.orders) {
        const found = data.orders.find(
          (o: any) => o.id === orderId || o.orderNumber === orderId
        );
        if (found) {
          setOrder(found);
        } else {
          console.warn("Order not found with ID:", orderId);
        }
      }
    } catch (err) {
      console.warn("Order poll notice:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
    const interval = setInterval(fetchOrder, 3000);
    return () => clearInterval(interval);
  }, [orderId]);

  // Handle Regenerate PIN (Live in-app security update)
  const handleRegeneratePin = async () => {
    if (!order) return;
    setIsRegeneratingPin(true);
    setPinFeedback(null);

    try {
      const res = await fetch("/api/orders/regenerate-pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id }),
      });

      const data = await res.json();

      if (data.success && data.newPin) {
        setOrder((prev) => (prev ? { ...prev, deliveryPin: data.newPin } : prev));
        setPinFeedback("New Delivery PIN generated live!");
        setTimeout(() => setPinFeedback(null), 4000);
      }
    } catch (err: any) {
      setPinFeedback("Failed to regenerate PIN: " + err.message);
    } finally {
      setIsRegeneratingPin(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center animate-pulse">
          <Bike className="w-6 h-6 animate-bounce" />
        </div>
        <p className="text-xs font-bold text-stone-500 mt-3">
          Connecting to Zuppo Live Tracking Grid...
        </p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex flex-col items-center justify-center p-4 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-black text-stone-900">Order Not Found</h3>
        <p className="text-xs text-stone-500 max-w-sm">
          We could not locate this order. It may have expired or been moved to archive.
        </p>
        <Link
          href="/"
          className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-lg transition"
        >
          Return to Food Store
        </Link>
      </div>
    );
  }

  // Calculate Stepper State
  const getStepIndex = (status: string) => {
    switch (status) {
      case "placed":
        return 1;
      case "preparing":
      case "ready":
        return 2;
      case "rider_assigned":
      case "picked_up":
        return 3;
      case "delivered":
        return 4;
      default:
        return 2;
    }
  };

  const currentStep = getStepIndex(order.status);
  const pinDigits = (order.deliveryPin || "----").split("");

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-900 flex flex-col justify-between selection:bg-orange-500 selection:text-white font-sans">
      {/* Top Navbar */}
      <header className="px-5 py-4 border-b border-[#EDE5DA] bg-[#FAF7F2]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <Link
          href="/"
          className="flex items-center gap-2 text-stone-600 hover:text-stone-900 font-bold text-xs transition duration-200"
        >
          <div className="w-8 h-8 rounded-full bg-white border border-[#E5DDD2] flex items-center justify-center shadow-xs">
            <ChevronLeft className="w-4 h-4 text-stone-700" />
          </div>
          <span>Back to Store</span>
        </Link>

        {/* Brand */}
        <Link href="/" className="flex items-center gap-1.5 group">
          <BrandLogo size={44} />
        </Link>

        <span className="text-[11px] font-bold text-stone-500">
          Order {order.orderNumber}
        </span>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-xl mx-auto w-full p-4 sm:p-6 space-y-5">
        {/* Feedback alert for PIN regenerate */}
        {pinFeedback && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{pinFeedback}</span>
          </div>
        )}

        {/* ================= 1. LIVE ORDER STATUS STEPPER & MAP (ZOMATO STYLE TOP CARD) ================= */}
        <div className="bg-white rounded-3xl overflow-hidden border border-[#EDE5DA] shadow-sm">
          <div className="p-5 pb-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">
                  {order.status === "delivered"
                    ? "Completed"
                    : order.status === "picked_up"
                    ? "Rider is on the way"
                    : order.status === "rider_assigned"
                    ? "Rider heading to restaurant"
                    : "Kitchen is preparing your order"}
                </span>
                <h2 className="text-xl font-black text-stone-900">
                  {order.status === "delivered" ? "Order Delivered!" : "Arriving in 15–20 Mins"}
                </h2>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                  order.status === "delivered"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : "bg-orange-50 text-orange-700 border-orange-300 animate-pulse"
                }`}
              >
                {order.status === "delivered" ? "Delivered" : "Live Tracking"}
              </span>
            </div>

            {/* Stepper Progress Bar */}
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-4 gap-2 text-center text-[10px] font-bold text-stone-500">
                <span className={currentStep >= 1 ? "text-orange-600 font-black" : ""}>1. Placed</span>
                <span className={currentStep >= 2 ? "text-orange-600 font-black" : ""}>2. Kitchen</span>
                <span className={currentStep >= 3 ? "text-orange-600 font-black" : ""}>3. On the Way</span>
                <span className={currentStep >= 4 ? "text-emerald-600 font-black" : ""}>4. Delivered</span>
              </div>

              <div className="relative flex items-center justify-between">
                <div className="absolute left-4 right-4 h-1 bg-[#EDE5DA] z-0" />
                <div
                  className="absolute left-4 h-1 bg-gradient-to-r from-orange-600 to-amber-500 z-0 transition-all duration-500"
                  style={{ width: `${((currentStep - 1) / 3) * 100}%` }}
                />

                {[1, 2, 3, 4].map((step) => {
                  const isPassed = currentStep >= step;
                  const isCurrent = currentStep === step;
                  return (
                    <div
                      key={step}
                      className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs z-10 border-2 transition-all duration-300 ${
                        isPassed
                          ? "bg-orange-600 border-white text-white shadow-md shadow-orange-600/30"
                          : "bg-white border-[#EDE5DA] text-stone-400"
                      } ${isCurrent ? "scale-110 ring-4 ring-orange-500/20" : ""}`}
                    >
                      {isPassed ? (
                        step === 4 && order.status === "delivered" ? (
                          <Check className="w-4 h-4 stroke-[3]" />
                        ) : step === 3 ? (
                          <Bike className="w-4 h-4" />
                        ) : step === 2 ? (
                          <ChefHat className="w-4 h-4" />
                        ) : (
                          <Check className="w-4 h-4 stroke-[3]" />
                        )
                      ) : (
                        step
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Live Map Integrated Directly Below Header */}
          <div className="px-4 pb-4 space-y-3">
            <AmbikapurDeliveryMap
              restaurantName={order.restaurantName}
              customerArea={order.deliveryArea}
              orderNumber={order.orderNumber}
              mode="customer"
              destination={order.status === "rider_assigned" ? "pickup" : "drop"}
              riderLocationUpdatedAt={order.riderLocationUpdatedAt}
              riderLat={order.riderLat}
              riderLng={order.riderLng}
              restaurantLat={order.pickupLat}
              restaurantLng={order.pickupLng}
              customerLat={order.deliveryLat}
              customerLng={order.deliveryLng}
              height="300px"
            />

            {!["delivered", "cancelled"].includes(order.status) && (
              <OrderDeliveryPin
                orderId={order.id}
                address={order.deliveryArea}
                hasPin={Number.isFinite(order.deliveryLat) && Number.isFinite(order.deliveryLng)}
                initialLat={order.deliveryLat}
                initialLng={order.deliveryLng}
                onSaved={fetchOrder}
              />
            )}

            {/* Partner & Rider Status Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs pt-1">
              <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EDE5DA] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">
                    Kitchen Partner
                  </span>
                  <strong className="text-stone-900 block font-bold truncate mt-0.5">
                    {order.restaurantName}
                  </strong>
                  <span className="text-[10px] text-stone-500 truncate block">
                    {order.pickupAddress || "Ambikapur Kitchen"}
                  </span>
                </div>
                {order.restaurantPhone ? (
                  <a
                    href={`tel:${order.restaurantPhone}`}
                    className="w-9 h-9 rounded-full bg-white border border-[#E5DDD2] flex items-center justify-center text-stone-700 hover:text-orange-600 transition shadow-2xs shrink-0"
                    title="Call Restaurant"
                  >
                    <Phone className="w-4 h-4" />
                  </a>
                ) : (
                  <div className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                    <Store className="w-4 h-4" />
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EDE5DA] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 block">
                    Delivery Partner
                  </span>
                  <strong className="text-stone-900 block font-bold truncate mt-0.5">
                    {order.riderName || "Assigning Rider…"}
                  </strong>
                  <span className="text-[10px] text-stone-500 block">
                    {order.riderName ? "Verified Zuppo Fleet" : "Waiting for kitchen ready"}
                  </span>
                </div>
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <Bike className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2. IN-APP SMART DELIVERY PIN CARD (ZERO SMS COST) ================= */}
        <div className="bg-white rounded-3xl p-6 border-2 border-orange-200/90 shadow-[0_20px_50px_rgba(255,100,0,0.08)] space-y-4 relative overflow-hidden">
          <div className="flex items-center justify-between pb-2 border-b border-[#EDE5DA]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 block">
                  Zero-SMS Secure Handshake
                </span>
                <h3 className="text-sm font-black text-stone-900 leading-none">
                  Your In-App Delivery PIN
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRegeneratePin}
              disabled={isRegeneratingPin || order.status === "delivered"}
              className="text-[11px] font-bold text-stone-600 hover:text-orange-600 disabled:opacity-40 bg-[#FAF7F2] hover:bg-orange-50 border border-[#E5DDD2] px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Generate a new secure PIN"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRegeneratingPin ? "animate-spin text-orange-600" : ""}`} />
              <span>{isRegeneratingPin ? "Refreshing..." : "Regenerate PIN"}</span>
            </button>
          </div>

          <div className="text-center py-2 space-y-2">
            <div className="flex justify-center items-center gap-3">
              {pinDigits.map((digit, idx) => (
                <div
                  key={idx}
                  className="w-14 h-16 sm:w-16 sm:h-20 rounded-2xl bg-gradient-to-b from-[#FAF7F2] to-white border-2 border-orange-400 text-stone-900 font-mono font-black text-3xl sm:text-4xl flex items-center justify-center shadow-md shadow-orange-500/10"
                >
                  {digit}
                </div>
              ))}
            </div>

            <p className="text-xs text-stone-500 font-medium max-w-sm mx-auto pt-1 leading-relaxed">
              Share this 4-digit PIN with <strong>{order.riderName || "the rider"}</strong> only at your doorstep after receiving your food package.
            </p>
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200/80 rounded-2xl flex items-center gap-2 text-[11px] text-amber-900">
            <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              100% In-App Verification. No SMS required. Eliminates wrong deliveries.
            </span>
          </div>
        </div>

        {/* ================= 3. BILL BREAKDOWN & ITEMS ================= */}
        <div className="bg-white rounded-3xl p-6 border border-[#EDE5DA] shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#EDE5DA]">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-orange-600" />
              <h4 className="text-xs font-black uppercase tracking-wider text-stone-900">
                Order Items & Bill
              </h4>
            </div>
            <span className="text-xs font-black text-stone-900">
              {order.paymentMethod} • ₹{order.totalAmount}
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center text-stone-700">
                <span className="font-medium">
                  {item.qty}x {item.name}
                </span>
                <span className="font-bold text-stone-900">₹{item.price * item.qty}</span>
              </div>
            ))}
          </div>

          <div className="pt-3 border-t border-[#EDE5DA] space-y-1.5 text-xs text-stone-500">
            <div className="flex justify-between">
              <span>Item Subtotal</span>
              <span>₹{order.itemTotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Partner Fee</span>
              <span>₹{order.deliveryFee}</span>
            </div>
            <div className="flex justify-between">
              <span>Platform Fee</span>
              <span>₹{order.platformFee}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-stone-900 pt-2 border-t border-[#EDE5DA]">
              <span>Total Paid / Payable</span>
              <span>₹{order.totalAmount}</span>
            </div>
          </div>

          <div className="p-3 bg-[#FAF7F2] rounded-2xl border border-[#EDE5DA] text-xs text-stone-600 space-y-1">
            <div className="flex items-center gap-1.5 text-stone-800 font-bold">
              <MapPin className="w-3.5 h-3.5 text-orange-600" />
              <span>Delivery Address:</span>
            </div>
            <p className="pl-5 text-stone-500">{order.deliveryArea}</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-stone-400 border-t border-[#EDE6DC]">
        © 2026 Zuppo Technologies • Live Delivery Tracking • Zero-SMS Handshake
      </footer>
    </div>
  );
}
