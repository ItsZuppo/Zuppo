"use client";

import { useEffect, useState } from "react";

export default function PasswordReset({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail.includes("@") ? initialEmail : "");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!cooldown) return;
    const timer = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (sent && password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetch(sent ? "/api/auth/reset-password" : "/api/auth/send-otp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sent ? { email, otp, password } : { email, purpose: "recovery" }),
      });
      const result = await response.json();
      if (!result.success) { setError(result.error || "Please try again."); return; }
      setMessage(result.message);
      if (sent) { setSent(false); setOtp(""); setPassword(""); setConfirm(""); }
      else { setSent(true); setCooldown(60); }
    } catch { setError("Could not connect. Please try again."); }
    finally { setBusy(false); }
  }
  const inputClass = "w-full rounded-xl border border-stone-300 bg-white p-3 text-sm text-stone-900";
  return <form onSubmit={submit} className="space-y-4">
    <h2 className="text-xl font-bold">Reset your password</h2>
    <p className="text-sm text-stone-600">We will email you a verification code. Enter it here to choose a new password.</p>
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <label className="block text-sm">Registered email<input className={inputClass} type="email" autoComplete="email" required value={email} disabled={sent || busy} onChange={e => setEmail(e.target.value)} /></label>
    {sent && <>
      <label className="block text-sm">Email code<input className={inputClass} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={otp} onChange={e => setOtp(e.target.value)} /></label>
      <label className="block text-sm">New password<input className={inputClass} type="password" autoComplete="new-password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} /></label>
      <label className="block text-sm">Confirm new password<input className={inputClass} type="password" autoComplete="new-password" minLength={6} required value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
      <button type="button" disabled={busy || cooldown > 0} onClick={() => { setSent(false); setOtp(""); }} className="text-sm text-orange-700">{cooldown ? `Request a new code in ${cooldown}s` : "Change email / request another code"}</button>
    </>}
    <button disabled={busy} className="w-full rounded-xl bg-orange-600 p-3 font-bold text-white">{busy ? "Please wait…" : sent ? "Save new password" : "Send reset code"}</button>
    <button type="button" onClick={onBack} className="w-full p-2 text-sm font-semibold text-stone-600">Back to sign in</button>
  </form>;
}
