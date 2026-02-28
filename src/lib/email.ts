import { Resend } from "resend";

interface SendTripInviteEmailInput {
  inviteeEmail: string;
  inviterName: string;
  tripName: string;
  role: "EDITOR" | "VIEWER";
  acceptUrl: string;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function sendTripInviteEmail(input: SendTripInviteEmailInput) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return {
      delivered: false,
      reason: "RESEND_API_KEY is not configured",
    };
  }

  const fromEmail =
    process.env.INVITE_EMAIL_FROM || "PlanYourTrip <onboarding@resend.dev>";
  const resend = new Resend(apiKey);
  const safeTripName = escapeHtml(input.tripName);
  const safeInviterName = escapeHtml(input.inviterName);
  const safeAcceptUrl = escapeHtml(input.acceptUrl);

  const roleLabel = input.role === "EDITOR" ? "Editor" : "Viewer";
  const subject = `${input.inviterName} invited you to collaborate on "${input.tripName}"`;
  const text = [
    `${input.inviterName} invited you to collaborate on "${input.tripName}" as ${roleLabel}.`,
    "",
    "Accept invite:",
    input.acceptUrl,
    "",
    "This invite expires in 7 days.",
  ].join("\n");

  const html = `
    <div style="font-family: Inter, Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin: 0 0 8px;">You have a new collaboration invite</h2>
      <p style="margin: 0 0 12px;">
        <strong>${safeInviterName}</strong> invited you to collaborate on
        <strong>${safeTripName}</strong> as <strong>${roleLabel}</strong>.
      </p>
      <p style="margin: 0 0 18px;">
        <a
          href="${safeAcceptUrl}"
          style="background: #2563eb; color: white; text-decoration: none; padding: 10px 14px; border-radius: 8px; display: inline-block;"
        >
          Accept invite
        </a>
      </p>
      <p style="margin: 0; color: #475569; font-size: 13px;">
        Or copy this link:<br />
        <a href="${safeAcceptUrl}">${safeAcceptUrl}</a>
      </p>
      <p style="margin: 12px 0 0; color: #64748b; font-size: 12px;">
        This invite expires in 7 days.
      </p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: [input.inviteeEmail],
      subject,
      text,
      html,
    });
    return { delivered: true };
  } catch (error) {
    return {
      delivered: false,
      reason: error instanceof Error ? error.message : "Failed to send invite email",
    };
  }
}
