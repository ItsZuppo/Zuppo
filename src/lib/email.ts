interface SendEmailParams {
  toEmail: string;
  toName?: string;
  subject: string;
  htmlContent: string;
}

export async function sendEmailViaBrevo({
  toEmail,
  toName,
  subject,
  htmlContent,
}: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL || "zuuppo@gmail.com";
  const senderName = process.env.BREVO_SENDER_NAME || "zuppo";

  if (!apiKey) {
    console.error("Brevo API Notice: Missing BREVO_API_KEY in environment variables.");
    return { success: false, error: "Email service unconfigured" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: senderName,
          email: senderEmail,
        },
        to: [
          {
            email: toEmail,
            name: toName || toEmail.split("@")[0],
          },
        ],
        subject,
        htmlContent,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Brevo API error:", data);
      return { success: false, error: data.message || "Failed to send email" };
    }

    return { success: true, messageId: data.messageId };
  } catch (err: any) {
    console.error("Brevo API network exception:", err);
    return { success: false, error: err.message || "Network exception" };
  }
}

export async function sendOtpEmail(
  toEmail: string,
  toName: string,
  otp: string,
  roleTitle: string = "Account Verification"
): Promise<{ success: boolean; error?: string }> {
  const subject = `Your AmbiBites Code: ${otp} (Valid for 10 mins)`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05), 0 8px 10px -6px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
          .header { background: linear-gradient(135deg, #ea580c 0%, #f59e0b 100%); padding: 32px 24px; text-align: center; }
          .logo { width: 50px; height: 50px; background: #ffffff; border-radius: 16px; margin: 0 auto 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 26px; font-weight: 900; color: #ea580c; line-height: 50px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
          .brand-title { color: #ffffff; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px; }
          .brand-sub { color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
          .content { padding: 32px 28px; }
          .greeting { font-size: 18px; font-weight: 800; color: #0f172a; margin-top: 0; }
          .desc { font-size: 14px; color: #64748b; line-height: 1.6; margin: 12px 0 24px; }
          .otp-container { background: #fff7ed; border: 2px dashed #fdba74; border-radius: 16px; padding: 20px; text-align: center; margin: 24px 0; }
          .otp-code { font-size: 36px; font-weight: 900; letter-spacing: 8px; color: #c2410c; font-family: monospace; }
          .otp-expiry { font-size: 11px; font-weight: 700; color: #ea580c; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }
          .security-note { font-size: 12px; color: #94a3b8; line-height: 1.5; border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 24px; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div class="logo">A</div>
            <h1 class="brand-title">AmbiBites</h1>
            <div class="brand-sub">Ambikapur Food Delivery</div>
          </div>
          <div class="content">
            <h2 class="greeting">Hello ${toName || "Foodie"}!</h2>
            <p class="desc">
              Here is your one-time verification code for <strong>${roleTitle}</strong> on AmbiBites Ambikapur.
            </p>
            
            <div class="otp-container">
              <div class="otp-code">${otp}</div>
              <div class="otp-expiry">Expires in 10 minutes</div>
            </div>

            <p class="desc" style="font-size: 13px;">
              Please do not share this OTP with anyone, including restaurant partners or delivery riders.
            </p>

            <div class="security-note">
              🔒 <strong>Ambikapur Hyperlocal Security:</strong> If you did not request this OTP, you can safely ignore this email.
            </div>
          </div>
          <div class="footer">
            &copy; 2026 AmbiBites Technologies • Ambikapur, Surguja, CG • All rights reserved.
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmailViaBrevo({
    toEmail,
    toName,
    subject,
    htmlContent,
  });
}
