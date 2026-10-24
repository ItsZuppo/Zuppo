/**
 * In-memory OTP Store for Verification Codes
 * Features 10-minute automatic expiration and single-use invalidation.
 */

interface OtpRecord {
  code: string;
  email: string;
  expiresAt: number; // Timestamp
  verified: boolean;
  attempts: number;
  challenge: string;
}

// Global variable survives HMR in Next.js development
const globalForOtp = global as unknown as { otpCache: Map<string, OtpRecord> };
const otpCache = globalForOtp.otpCache || new Map<string, OtpRecord>();
if (process.env.NODE_ENV !== "production") globalForOtp.otpCache = otpCache;

export function storeOtp(email: string, code: string, challenge: string): void {
  const normalized = email.toLowerCase().trim();
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

  if (!otpCache.has(normalized) && otpCache.size >= 10000) throw new Error("Verification service busy. Retry later.");
  otpCache.set(normalized, {
    code,
    email: normalized,
    expiresAt,
    verified: false, attempts: 0, challenge,
  });

  // Prune expired records
  const now = Date.now();
  for (const [key, val] of otpCache.entries()) {
    if (val.expiresAt < now) {
      otpCache.delete(key);
    }
  }
}

export function verifyOtpCode(email: string, inputCode: string, challenge: string): { valid: boolean; reason?: string } {
  const normalized = email.toLowerCase().trim();
  const record = otpCache.get(normalized);

  if (!record || record.challenge !== challenge || record.attempts >= 5) {
    return { valid: false, reason: "No OTP found or expired. Please request a new one." };
  }

  if (Date.now() > record.expiresAt) {
    otpCache.delete(normalized);
    return { valid: false, reason: "OTP has expired. Please request a new code." };
  }

  record.attempts++;
  if (record.code !== inputCode.trim()) {
    return { valid: false, reason: "Incorrect OTP code. Please check and try again." };
  }

  // Mark verified
  record.verified = true;
  otpCache.set(normalized, record);

  return { valid: true };
}

export function isEmailOtpVerified(email: string, challenge: string): boolean {
  const normalized = email.toLowerCase().trim();
  const record = otpCache.get(normalized);
  if (!record) return false;
  if (Date.now() > record.expiresAt) return false;
  return record.verified === true && record.challenge === challenge;
}

export function consumeOtpVerification(email: string): void {
  const normalized = email.toLowerCase().trim();
  otpCache.delete(normalized);
}

export function maySendOtp(email: string): boolean {
  const record = otpCache.get(email.toLowerCase().trim());
  return !record || record.expiresAt - Date.now() <= 9 * 60 * 1000;
}
