import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const transport = createTransport();
const FROM = process.env.SMTP_FROM ?? "Blessed Ave Cafe <noreply@blessedave.com>";

export interface OrderReceiptData {
  orderId: string;
  customerName?: string;
  customerEmail?: string;
  items: { name: string; quantity: number; subtotal: number; options?: string }[];
  total: number;
  paymentMethod: string;
  source: string;
}

export async function sendOrderReceipt(data: OrderReceiptData) {
  if (!transport || !data.customerEmail) return;

  const itemRows = data.items
    .map(
      (i) =>
        `<tr>
          <td style="padding:8px 0;border-bottom:1px solid #f0ebe3;">
            <strong>${i.name}</strong> × ${i.quantity}
            ${i.options ? `<br/><span style="color:#9c8a72;font-size:12px;">${i.options}</span>` : ""}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #f0ebe3;text-align:right;font-weight:600;">
            ₱${(i.subtotal / 100).toFixed(2)}
          </td>
        </tr>`
    )
    .join("");

  const sourceLabel =
    data.source === "ONLINE"
      ? "Online Order"
      : data.source === "QR_TABLE"
      ? "Table Order"
      : "POS Order";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#faf7f2;font-family:'Georgia',serif;">
  <div style="max-width:540px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);">

    <!-- Header -->
    <div style="background:#2c1810;padding:32px 40px;text-align:center;">
      <div style="width:48px;height:48px;background:#c9a96e;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;margin-bottom:12px;">
        <span style="color:#fff;font-size:22px;font-weight:900;line-height:1;">B</span>
      </div>
      <h1 style="margin:0;color:#faf7f2;font-size:22px;letter-spacing:1px;">Blessed Ave Cafe</h1>
      <p style="margin:4px 0 0;color:#c9a96e;font-size:13px;">Order Confirmed ✓</p>
    </div>

    <!-- Body -->
    <div style="padding:32px 40px;">
      <p style="color:#2c1810;font-size:15px;margin:0 0 8px;">
        Hi ${data.customerName ?? "there"} 👋
      </p>
      <p style="color:#6b5745;font-size:14px;margin:0 0 24px;">
        Your ${sourceLabel.toLowerCase()} has been confirmed. Here's your receipt.
      </p>

      <!-- Order ID -->
      <div style="background:#faf7f2;border-radius:8px;padding:12px 16px;margin-bottom:24px;">
        <p style="margin:0;color:#9c8a72;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Order ID</p>
        <p style="margin:4px 0 0;color:#2c1810;font-size:13px;font-family:monospace;">${data.orderId}</p>
      </div>

      <!-- Items -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        ${itemRows}
      </table>

      <!-- Total -->
      <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:2px solid #2c1810;margin-bottom:24px;">
        <span style="font-size:16px;font-weight:700;color:#2c1810;">Total</span>
        <span style="font-size:18px;font-weight:700;color:#2c1810;">₱${(data.total / 100).toFixed(2)}</span>
      </div>

      <!-- Payment method -->
      <p style="color:#9c8a72;font-size:13px;text-align:center;margin:0 0 24px;">
        Paid via ${data.paymentMethod}
      </p>

      <p style="color:#6b5745;font-size:14px;text-align:center;margin:0;">
        Thank you for ordering from Blessed Ave! ☕<br/>
        We'll have it ready for you shortly.
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#faf7f2;padding:16px 40px;text-align:center;border-top:1px solid #f0ebe3;">
      <p style="margin:0;color:#c9a96e;font-size:12px;">Blessed Ave Cafe · Manila, Philippines</p>
    </div>
  </div>
</body>
</html>`;

  await transport.sendMail({
    from: FROM,
    to: data.customerEmail,
    subject: `Your Blessed Ave order is confirmed! (${data.orderId.slice(-6).toUpperCase()})`,
    html,
  });
}
