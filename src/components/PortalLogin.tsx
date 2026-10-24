"use client";
import { fetchWithTimeout as fetch } from "@/lib/browserRequest";

import BrandLogo from "@/components/BrandLogo";
import PasswordReset from "@/components/PasswordReset";
import React, { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChefHat,
  Bike,
  ShieldCheck,
  User,
  Lock,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Store,
  ChevronLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Phone,
  Mail,
  Upload,
  FileCheck,
  Check,
  Clock,
  Building2,
  Car,
  FileText,
  BadgeCheck,
  Eye,
  EyeOff,
  Flame,
} from "lucide-react";
import { compressImage } from "@/lib/imageCompression";

type RoleType = "customer" | "partner" | "rider" | "admin";
type AuthMode = "login" | "register";

export default function PortalLogin({ role = "customer" }: { role?: RoleType }) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();
  const navigate = (path: string) => startNavigation(() => router.push(path));
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [resetPassword, setResetPassword] = useState(false);
  const activeRole = role;

  // Multi-step Registration Wizard: Step 1 (Basic Details & OTP) -> Step 2 (KYC & Documents)
  const [regStep, setRegStep] = useState<1 | 2>(1);

  // Login form states
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Common Registration states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [phone, setPhone] = useState("+91 ");

  // OTP Verification states (Brevo)
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [resendCountdown, setResendCountdown] = useState(0);

  // Restaurant Partner states
  const [kitchenName, setKitchenName] = useState("");
  const [cuisine, setCuisine] = useState("North Indian, Fast Food, Snacks");
  const [area, setArea] = useState("Gandhi Chowk");
  const [address, setAddress] = useState("");
  const [fssaiNumber, setFssaiNumber] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [aadhaarNumber, setAadhaarNumber] = useState("");
  const [panDocUrl, setPanDocUrl] = useState("");
  const [aadhaarDocUrl, setAadhaarDocUrl] = useState("");
  const [panDocStats, setPanDocStats] = useState<string | null>(null);
  const [aadhaarDocStats, setAadhaarDocStats] = useState<string | null>(null);
  const [isUploadingPan, setIsUploadingPan] = useState(false);
  const [isUploadingAadhaar, setIsUploadingAadhaar] = useState(false);

  // Rider states
  const [vehicleNumber, setVehicleNumber] = useState("CG 15 ");
  const [dlNumber, setDlNumber] = useState("");
  const [dlDocUrl, setDlDocUrl] = useState("");
  const [dlDocStats, setDlDocStats] = useState<string | null>(null);
  const [isUploadingDl, setIsUploadingDl] = useState(false);

  // Feedback & Application status
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submittedPending, setSubmittedPending] = useState<boolean>(false);

  // Check if already authenticated
  useEffect(() => {
    const wantsReset = new URLSearchParams(window.location.search).get("reset") === "true";
    if (wantsReset) { setResetPassword(true); return; }
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated && data.user && data.user.role === role) {
          if (data.user.role === "partner") navigate("/partner");
          else if (data.user.role === "rider") navigate("/rider");
          else if (data.user.role === "admin") navigate("/admin");
          else if (data.user.role === "customer") router.replace("/account");
        }
      })
      .catch(() => {});
  }, [router, role]);

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setTimeout(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCountdown]);

  // Reset inputs when switching role or mode
  useEffect(() => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSubmittedPending(false);
    setRegStep(1);
    setIsEmailVerified(false);
    setOtpSent(false);
    setOtpCode("");
  }, [activeRole, authMode]);

  // 1. Send OTP via Brevo
  const handleSendOtp = async () => {
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address to receive your OTP.");
      return;
    }

    setIsSendingOtp(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          name: fullName || kitchenName || "Foodie",
          role: activeRole,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setOtpSent(true);
        setResendCountdown(15);
        setSuccessMsg(`Verification code sent to ${email}. Check your inbox and spam folder.`);
      } else {
        setErrorMsg(data.error || "Failed to send OTP email.");
      }
    } catch (err: any) {
      setErrorMsg("Network error sending OTP: " + err.message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  // 2. Verify OTP
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.trim().length < 6) {
      setErrorMsg("Please enter the complete 6-digit verification code.");
      return;
    }

    setIsVerifyingOtp(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: otpCode }),
      });

      const data = await res.json();
      if (data.success) {
        setIsEmailVerified(true);
        setSuccessMsg("Email verified successfully! You can now proceed.");
      } else {
        setErrorMsg(data.error || "Invalid OTP code.");
      }
    } catch (err: any) {
      setErrorMsg("Network error verifying OTP: " + err.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // 3. Compress & Upload to Cloudflare R2
  const handleCompressAndUpload = async (
    file: File,
    type: "pan" | "aadhaar" | "dl"
  ) => {
    if (type === "pan") setIsUploadingPan(true);
    else if (type === "aadhaar") setIsUploadingAadhaar(true);
    else if (type === "dl") setIsUploadingDl(true);

    setErrorMsg(null);

    try {
      const compressed = await compressImage(file, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.8,
      });

      const statsText = `${compressed.originalSizeKb} KB ➔ ${compressed.compressedSizeKb} KB (${compressed.savedPercent}% saved)`;

      const fd = new FormData();
      fd.append("file", compressed.file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (data.success && data.url) {
        if (type === "pan") {
          setPanDocUrl(data.url);
          setPanDocStats(statsText);
        } else if (type === "aadhaar") {
          setAadhaarDocUrl(data.url);
          setAadhaarDocStats(statsText);
        } else if (type === "dl") {
          setDlDocUrl(data.url);
          setDlDocStats(statsText);
        }
      } else {
        setErrorMsg("Failed to upload document to Cloudflare CDN.");
      }
    } catch (err: any) {
      setErrorMsg("Document upload notice: " + err.message);
    } finally {
      if (type === "pan") setIsUploadingPan(false);
      else if (type === "aadhaar") setIsUploadingAadhaar(false);
      else if (type === "dl") setIsUploadingDl(false);
    }
  };

  // Validate Step 1 Before Moving to Step 2
  const handleProceedToStep2 = () => {
    setErrorMsg(null);
    if (activeRole === "partner" && !kitchenName.trim()) {
      setErrorMsg("Please enter your Restaurant / Kitchen name.");
      return;
    }
    if (!fullName.trim()) {
      setErrorMsg("Please enter the contact / owner full name.");
      return;
    }
    if (!phone.trim() || phone.trim() === "+91") {
      setErrorMsg("Please enter a valid phone number.");
      return;
    }
    if (!isEmailVerified) {
      setErrorMsg("Please verify your email address with the OTP first.");
      return;
    }
    if (!regPassword || regPassword.length < 6) {
      setErrorMsg("Please create a password of at least 6 characters.");
      return;
    }
    if (activeRole === "rider" && !vehicleNumber.trim()) {
      setErrorMsg("Please enter your vehicle and plate details.");
      return;
    }

    setRegStep(2);
  };

  // 4. Submit Registration
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!isEmailVerified) {
      setErrorMsg("Please verify your email address with OTP before submitting.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          name: fullName || kitchenName || "Partner",
          email,
          password: regPassword,
          phone,
          // Restaurant Fields
          kitchenName,
          cuisine,
          area,
          address,
          fssaiNumber,
          panNumber,
          aadhaarNumber,
          panDocUrl,
          aadhaarDocUrl,
          // Rider Fields
          vehicleNumber,
          dlNumber,
          dlDocUrl,
        }),
      });

      const data = await res.json();

      if (data.success) {
        if (data.status === "pending_verification") {
          setSubmittedPending(true);
        } else {
          setSuccessMsg("Account created! Redirecting to food store...");
          navigate(data.user?.role === "admin" ? "/admin" : "/account");
        }
      } else {
        setErrorMsg(data.error || "Registration failed.");
      }
    } catch (err: any) {
      setErrorMsg("Registration error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 5. Submit Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: activeRole,
          username,
          password,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setSuccessMsg(`Welcome back to zuppo! Redirecting...`);
        {
          if (activeRole === "partner") navigate("/partner");
          else if (activeRole === "rider") navigate("/rider");
          else if (activeRole === "admin") navigate("/admin");
          else navigate("/account");
        }
      } else {
        setErrorMsg(data.error || "Login failed. Please check your credentials.");
      }
    } catch (err: any) {
      setErrorMsg("Network error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Quick Demo Logins for Partner, Rider, Admin
  const quickDemoLogin = (role: RoleType, user: string, pass: string, targetPath: string) => {
    setUsername(user);
    setPassword(pass);
    setLoading(true);
    fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role, username: user, password: pass }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setSuccessMsg(`Welcome, ${d.user.name}!`);
          navigate(targetPath);
        } else {
          setErrorMsg(d.error || "Login failed");
          setLoading(false);
        }
      });
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-stone-900 flex flex-col justify-between selection:bg-orange-500 selection:text-white font-sans">
      {/* Top Navbar */}
      <header className="px-6 py-4 border-b border-[#EDE6DC] bg-[#FAF7F2]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <Link
          href="/"
          className="flex items-center gap-2 text-stone-500 hover:text-stone-900 font-bold text-xs transition duration-200"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Back to Food Store</span>
        </Link>

        {/* Brand Pill in Header */}
        <div className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-full border border-[#E8E0D5] shadow-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-black tracking-tight text-stone-700">
            zuppo <span className="text-orange-600 font-medium">Identity Portal</span>
          </span>
        </div>
      </header>

      {/* Main Center Content */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-xl space-y-6">
          {/* Logo & Header Title */}
          <div className="text-center space-y-2">
            <Link href="/" className="inline-flex items-center gap-2.5 group">
              <BrandLogo size={128} className="rounded-3xl shadow-lg shadow-orange-500/10" />
            </Link>

            <h1 className="text-xl sm:text-2xl font-black text-stone-900 pt-1 tracking-tight">
              {authMode === "login"
                ? (activeRole === "admin" ? "Your operations, in one place" : activeRole === "partner" ? "Welcome to your kitchen" : activeRole === "rider" ? "Ready for your next delivery?" : "Welcome back to zuppo")
                : activeRole === "partner"
                ? "Partner with zuppo"
                : activeRole === "rider"
                ? "Join as a zuppo Delivery Rider"
                : "Create Your zuppo Account"}
            </h1>
            <p className="text-xs text-stone-500 max-w-sm mx-auto font-medium leading-relaxed">
              {authMode === "login"
                ? (activeRole === "admin" ? "Sign in to manage orders, restaurants and your delivery team." : activeRole === "partner" ? "Manage your menu, prepare orders and keep your kitchen moving." : activeRole === "rider" ? "Sign in to view delivery tasks and your earnings." : "Sign in to order your favourites and track your deliveries.")
                : activeRole === "partner" || activeRole === "rider"
                ? "Complete the quick 2-step registration & KYC verification to start earning."
                : "Order your favorite meals across the city with lightning fast delivery."}
            </p>
          </div>

          {/* Mode Switcher: Sign In vs Register Tabs */}
          <div className="flex bg-[#EFE9DF] p-1.5 rounded-2xl border border-[#E5DDD2] shadow-inner">
            <button
              onClick={() => { setResetPassword(false); setAuthMode("login"); }}
              className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all duration-200 cursor-pointer ${
                authMode === "login"
                  ? "bg-white text-stone-900 shadow-md shadow-stone-300/40"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Sign In (Login)
            </button>
            {activeRole !== "admin" && <button
              onClick={() => { setResetPassword(false); setAuthMode("register"); }}
              className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all duration-200 cursor-pointer ${
                authMode === "register"
                  ? "bg-white text-stone-900 shadow-md shadow-stone-300/40"
                  : "text-stone-500 hover:text-stone-900"
              }`}
            >
              Register New Account {activeRole !== "customer" && "(KYC)"}
            </button>}
          </div>

          <div className="portal-entry-label">
            <span className="portal-entry-dot" />
            {activeRole === "customer" ? "Customer account" : activeRole === "partner" ? "Restaurant partner workspace" : activeRole === "rider" ? "Delivery partner workspace" : "Admin workspace"}
          </div>

          {/* Main Card Container */}
          <div className="bg-white border border-[#EDE5DA] rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_20px_50px_rgba(200,180,160,0.15)] relative overflow-hidden">
            {/* Feedback Notifications */}
            {errorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-start gap-2.5 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* PENDING APPROVAL SUBMITTED SCREEN */}
            {submittedPending ? (
              <div className="text-center py-6 space-y-5 animate-in zoom-in-95">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto border border-amber-200 shadow-inner">
                  <Clock className="w-8 h-8 animate-pulse" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-stone-900 tracking-tight">
                    Application Submitted for Verification!
                  </h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto leading-relaxed">
                    Thank you, <strong>{fullName || kitchenName}</strong>! Your
                    details and KYC documents have been securely received by the{" "}
                    <strong>zuppo Admin Team</strong>.
                  </p>
                </div>

                <div className="p-4 bg-[#FAF7F2] rounded-2xl border border-[#EDE5DA] text-left space-y-2.5 text-xs">
                  <div className="flex justify-between text-stone-500">
                    <span>Role Applied:</span>
                    <strong className="text-stone-900 uppercase font-black">
                      {activeRole === "partner" ? "Restaurant Partner" : "Fleet Delivery Rider"}
                    </strong>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Verification Status:</span>
                    <span className="text-amber-700 font-bold flex items-center gap-1 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200">
                      <Clock className="w-3 h-3" /> Under Review (2-4 hrs)
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Email Updates:</span>
                    <span className="text-stone-900 font-mono font-medium">{email}</span>
                  </div>
                </div>

                <p className="text-[11px] text-stone-400">
                  You will receive an approval email from <strong>zuppo</strong> as soon as your
                  profile is verified. You can then log in and start receiving orders.
                </p>

                <button
                  onClick={() => {
                    setSubmittedPending(false);
                    setAuthMode("login");
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white font-black text-xs px-6 py-3 rounded-2xl shadow-lg shadow-orange-600/20 hover:shadow-xl transition-all duration-200 cursor-pointer"
                >
                  Return to Sign In Screen
                </button>
              </div>
            ) : resetPassword ? (
              <PasswordReset initialEmail={username} onBack={() => setResetPassword(false)} />
            ) : authMode === "login" ? (
              /* ================== SIGN IN (LOGIN) ================== */
              <div className="space-y-5">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold text-stone-700 block mb-1">
                      {activeRole === "customer"
                        ? "Email address"
                        : activeRole === "partner"
                        ? "Kitchen Email / Username"
                        : activeRole === "rider"
                        ? "Rider Email / Username"
                        : "Admin Email / Username"}
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder={
                          activeRole === "partner"
                            ? "e.g. royal@zuppo.com"
                            : activeRole === "rider"
                            ? "e.g. rider@zuppo.com"
                            : "you@example.com"
                        }
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[11px] font-bold text-stone-700">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => setResetPassword(true)}
                        className="text-[10px] text-orange-600 hover:underline font-bold"
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl pl-10 pr-10 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 transition font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || isNavigating}
                    className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-black text-xs py-3.5 px-4 rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {loading || isNavigating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Signing in to zuppo...</span>
                      </>
                    ) : (
                      <>
                        <span>Sign In as {activeRole.toUpperCase()}</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                </form>

                {/* Footer Switch Link */}
                {activeRole !== "admin" && <div className="text-center pt-2 border-t border-[#EDE5DA]">
                  <p className="text-xs text-stone-500">
                    Don&apos;t have an account?{" "}
                    <button
                      type="button"
                      onClick={() => { setResetPassword(false); setAuthMode("register"); }}
                      className="font-black text-orange-600 hover:text-orange-700 underline underline-offset-4 cursor-pointer"
                    >
                      Make a new account
                    </button>
                  </p>
                </div>}
              </div>
            ) : (
              /* ================== REGISTRATION WIZARD (ZOMATO/SWIGGY STYLE 2-SLIDE) ================== */
              <div className="space-y-5">
                {/* 2-Step Progress Indicator for Restaurant and Rider */}
                {(activeRole === "partner" || activeRole === "rider") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-stone-600">
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                            regStep === 1
                              ? "bg-orange-600 text-white"
                              : "bg-emerald-600 text-white"
                          }`}
                        >
                          {regStep > 1 ? "✓" : "1"}
                        </span>
                        Step 1: Account & Details
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
                            regStep === 2
                              ? "bg-orange-600 text-white"
                              : "bg-stone-200 text-stone-500"
                          }`}
                        >
                          2
                        </span>
                        Step 2: KYC & Documents
                      </span>
                    </div>

                    {/* Progress Bar Line */}
                    <div className="w-full h-1.5 bg-[#EDE5DA] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-600 to-amber-500 transition-all duration-300 rounded-full"
                        style={{ width: regStep === 1 ? "50%" : "100%" }}
                      />
                    </div>
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                  {/* ================= SLIDE / STEP 1: BASIC DETAILS & OTP ================= */}
                  {(regStep === 1 || activeRole === "customer") && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                      {activeRole === "partner" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-stone-700 block mb-1">
                              Restaurant / Kitchen Name *
                            </label>
                            <div className="relative">
                              <Building2 className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                required
                                placeholder="e.g. Royal Sweets & Cafe"
                                value={kitchenName}
                                onChange={(e) => setKitchenName(e.target.value)}
                                className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl pl-9 pr-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-stone-700 block mb-1">
                              Owner / Manager Name *
                            </label>
                            <input
                              type="text"
                              required
                              placeholder="e.g. Ramesh Agrawal"
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl px-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Full Legal Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Rahul Sharma"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl px-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition"
                          />
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Mobile Number *
                          </label>
                          <div className="relative">
                            <Phone className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="tel"
                              required
                              placeholder="+91 98261 44551"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl pl-9 pr-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Create Password (min 6 chars) *
                          </label>
                          <div className="relative">
                            <Lock className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="password"
                              required
                              placeholder="••••••••"
                              value={regPassword}
                              onChange={(e) => setRegPassword(e.target.value)}
                              className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl pl-9 pr-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 outline-none transition"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Partner Details */}
                      {activeRole === "partner" && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-bold text-stone-700 block mb-1">
                              City Area / Hub *
                            </label>
                            <select
                              value={area}
                              onChange={(e) => setArea(e.target.value)}
                              className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl px-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-orange-500 outline-none transition"
                            >
                              <option>Gandhi Chowk</option>
                              <option>Ghadi Chowk</option>
                              <option>Ring Road East</option>
                              <option>Kedarpur</option>
                              <option>Sadhar Hospital Road</option>
                              <option>Main Market</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[11px] font-bold text-stone-700 block mb-1">
                              Primary Cuisines
                            </label>
                            <input
                              type="text"
                              placeholder="e.g. North Indian, Fast Food"
                              value={cuisine}
                              onChange={(e) => setCuisine(e.target.value)}
                              className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl px-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-orange-500 outline-none transition"
                            />
                          </div>
                        </div>
                      )}

                      {/* Rider Details */}
                      {activeRole === "rider" && (
                        <div>
                          <label className="text-[11px] font-bold text-stone-700 block mb-1">
                            Vehicle Name & Plate Number *
                          </label>
                          <div className="relative">
                            <Car className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              required
                              placeholder="e.g. Hero Splendor (CG 15 AB 1002)"
                              value={vehicleNumber}
                              onChange={(e) => setVehicleNumber(e.target.value)}
                              className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-2xl pl-9 pr-3 py-2 text-xs text-stone-900 focus:bg-white focus:border-orange-500 outline-none transition"
                            />
                          </div>
                        </div>
                      )}

                      {/* Email OTP Verification Box (Brevo) */}
                      <div className="p-3.5 bg-[#FAF7F2] rounded-2xl border border-[#EDE5DA] space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-black text-stone-700 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-orange-600" />
                            <span>Verify your email *</span>
                          </label>
                          {isEmailVerified && (
                            <span className="text-[10px] font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1">
                              <Check className="w-3 h-3" /> Verified
                            </span>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="email"
                            required
                            disabled={isEmailVerified}
                            placeholder="Enter email e.g. you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="flex-1 bg-white border border-[#E5DDD2] rounded-xl px-3 py-2 text-xs text-stone-900 focus:border-orange-500 outline-none disabled:opacity-60 font-medium"
                          />
                          <button
                            type="button"
                            disabled={isSendingOtp || isEmailVerified || resendCountdown > 0}
                            onClick={handleSendOtp}
                            className="bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold text-[11px] px-3.5 py-2 rounded-xl transition duration-150 shrink-0 cursor-pointer shadow-xs"
                          >
                            {isSendingOtp
                              ? "Sending..."
                              : resendCountdown > 0
                              ? `Resend in ${resendCountdown}s`
                              : "Send OTP"}
                          </button>
                        </div>

                        {otpSent && !isEmailVerified && (
                          <div className="flex items-center gap-2 pt-1 animate-in fade-in">
                            <input
                              type="text"
                              maxLength={10}
                              placeholder="Email code"
                              value={otpCode}
                              onChange={(e) => setOtpCode(e.target.value)}
                              className="w-32 bg-white border border-orange-500 rounded-xl px-3 py-2 text-xs text-stone-900 text-center font-mono tracking-widest outline-none font-bold shadow-xs"
                            />
                            <button
                              type="button"
                              disabled={isVerifyingOtp}
                              onClick={handleVerifyOtp}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl transition duration-150 cursor-pointer shadow-xs"
                            >
                              {isVerifyingOtp ? "Checking..." : "Verify Code"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Customer Single-Step Submit */}
                      {activeRole === "customer" ? (
                        <button
                          type="submit"
                          disabled={loading || isNavigating}
                          className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-black text-xs py-3.5 px-4 rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {loading || isNavigating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Creating Account...</span>
                            </>
                          ) : (
                            <>
                              <span>Register & Start Ordering</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      ) : (
                        /* Partner & Rider: Slide 1 -> Slide 2 Trigger */
                        <button
                          type="button"
                          onClick={handleProceedToStep2}
                          className="w-full bg-stone-900 hover:bg-stone-800 text-white font-black text-xs py-3.5 px-4 rounded-2xl shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <span>Continue to Step 2: KYC & Documents</span>
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* ================= SLIDE / STEP 2: KYC & COMPLIANCE DOCUMENTS ================= */}
                  {regStep === 2 && (activeRole === "partner" || activeRole === "rider") && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2.5 text-xs text-amber-900">
                        <BadgeCheck className="w-4 h-4 text-amber-600 shrink-0" />
                        <span className="font-semibold">
                          Upload clear document photos. All images are compressed client-side to &lt;200KB before uploading to Cloudflare CDN.
                        </span>
                      </div>

                      {/* Partner Specific Documents */}
                      {activeRole === "partner" && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-stone-700 block mb-1">
                                FSSAI License Number
                              </label>
                              <input
                                type="text"
                                placeholder="14-digit FSSAI"
                                value={fssaiNumber}
                                onChange={(e) => setFssaiNumber(e.target.value)}
                                className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-xl px-3 py-2 text-xs text-stone-900 outline-none"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-stone-700 block mb-1">
                                PAN Card Number
                              </label>
                              <input
                                type="text"
                                placeholder="ABCDE1234F"
                                value={panNumber}
                                onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                                className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-xl px-3 py-2 text-xs text-stone-900 outline-none uppercase"
                              />
                            </div>
                          </div>

                          {/* PAN Photo */}
                          <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EDE5DA] flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-stone-900 block">
                                PAN Card Photo
                              </span>
                              <span className="text-[10px] text-stone-500">
                                {panDocStats || "JPG / PNG (Auto-compressed to ~150KB)"}
                              </span>
                            </div>
                            <label className="cursor-pointer bg-white hover:bg-stone-50 text-stone-900 font-bold text-[11px] px-3.5 py-1.5 rounded-xl border border-[#E0D8CC] shadow-xs inline-flex items-center gap-1.5 transition">
                              <Upload className="w-3.5 h-3.5 text-orange-600" />
                              <span>
                                {isUploadingPan
                                  ? "Uploading..."
                                  : panDocUrl
                                  ? "Uploaded ✓"
                                  : "Upload Photo"}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleCompressAndUpload(f, "pan");
                                }}
                              />
                            </label>
                          </div>

                          {/* Aadhaar Photo */}
                          <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EDE5DA] flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-stone-900 block">
                                Aadhaar Card Photo
                              </span>
                              <span className="text-[10px] text-stone-500">
                                {aadhaarDocStats || "JPG / PNG (Auto-compressed to ~150KB)"}
                              </span>
                            </div>
                            <label className="cursor-pointer bg-white hover:bg-stone-50 text-stone-900 font-bold text-[11px] px-3.5 py-1.5 rounded-xl border border-[#E0D8CC] shadow-xs inline-flex items-center gap-1.5 transition">
                              <Upload className="w-3.5 h-3.5 text-orange-600" />
                              <span>
                                {isUploadingAadhaar
                                  ? "Uploading..."
                                  : aadhaarDocUrl
                                  ? "Uploaded ✓"
                                  : "Upload Photo"}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleCompressAndUpload(f, "aadhaar");
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Rider Specific Documents */}
                      {activeRole === "rider" && (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[10px] font-bold text-stone-700 block mb-1">
                                Driving License (DL) No.
                              </label>
                              <input
                                type="text"
                                placeholder="CG-15-2022001122"
                                value={dlNumber}
                                onChange={(e) => setDlNumber(e.target.value.toUpperCase())}
                                className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-xl px-3 py-2 text-xs text-stone-900 outline-none uppercase"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold text-stone-700 block mb-1">
                                Aadhaar Number
                              </label>
                              <input
                                type="text"
                                maxLength={12}
                                placeholder="12-digit Aadhaar"
                                value={aadhaarNumber}
                                onChange={(e) => setAadhaarNumber(e.target.value)}
                                className="w-full bg-[#FAF7F2] border border-[#E5DDD2] rounded-xl px-3 py-2 text-xs text-stone-900 outline-none"
                              />
                            </div>
                          </div>

                          {/* DL Photo Upload */}
                          <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EDE5DA] flex items-center justify-between">
                            <div>
                              <span className="text-xs font-bold text-stone-900 block">
                                Driving License Photo
                              </span>
                              <span className="text-[10px] text-stone-500">
                                {dlDocStats || "JPG / PNG (Auto-compressed to ~150KB)"}
                              </span>
                            </div>
                            <label className="cursor-pointer bg-white hover:bg-stone-50 text-stone-900 font-bold text-[11px] px-3.5 py-1.5 rounded-xl border border-[#E0D8CC] shadow-xs inline-flex items-center gap-1.5 transition">
                              <Upload className="w-3.5 h-3.5 text-orange-600" />
                              <span>
                                {isUploadingDl
                                  ? "Uploading..."
                                  : dlDocUrl
                                  ? "Uploaded ✓"
                                  : "Upload Photo"}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleCompressAndUpload(f, "dl");
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Navigation buttons for Step 2 */}
                      <div className="flex items-center gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setRegStep(1)}
                          className="py-3 px-4 rounded-2xl border border-[#E0D8CC] bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs flex items-center gap-1.5 transition duration-150 cursor-pointer shadow-xs"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          <span>Back</span>
                        </button>

                        <button
                          type="submit"
                          disabled={loading || isNavigating}
                          className="flex-1 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 disabled:opacity-50 text-white font-black text-xs py-3.5 px-4 rounded-2xl shadow-lg shadow-orange-500/25 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {loading || isNavigating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Submitting Application to Admin...</span>
                            </>
                          ) : (
                            <>
                              <span>Submit Application for Approval</span>
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </form>

                {/* Footer Switch Link */}
                <div className="text-center pt-2 border-t border-[#EDE5DA]">
                  <p className="text-xs text-stone-500">
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => { setResetPassword(false); setAuthMode("login"); }}
                      className="font-black text-orange-600 hover:text-orange-700 underline underline-offset-4 cursor-pointer"
                    >
                      Sign in here
                    </button>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-stone-400 border-t border-[#EDE6DC]">
        © 2026 zuppo • Made for Ambikapur
      </footer>
    </div>
  );
}
