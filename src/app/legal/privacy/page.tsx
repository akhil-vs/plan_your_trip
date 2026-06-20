import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Privacy Policy — Viazo",
};

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy">
      <p className="lead">Last updated: May 2026</p>
      <p>
        Viazo (&quot;we&quot;, &quot;us&quot;) provides trip planning tools at viazo.app. This policy explains what we
        collect and how we use it when you use our web application.
      </p>
      <h2>Information we collect</h2>
      <ul>
        <li>Account details you provide (name, email, password hash).</li>
        <li>Trip data you create (waypoints, day plans, notes, collaboration membership).</li>
        <li>Usage and diagnostics (e.g. analytics) to improve reliability.</li>
        <li>Payment status from Stripe when you subscribe (we do not store full card numbers).</li>
      </ul>
      <h2>How we use information</h2>
      <p>
        We use your data to operate the service: save itineraries, show maps, send collaboration invites or password
        resets, process subscriptions, and respond to support requests.
      </p>
      <h2>Third-party services</h2>
      <p>
        We rely on processors such as Mapbox (maps and geocoding), OpenTripMap and Geoapify (place data), hosting and
        database providers, Resend (email), Stripe (billing), and optional OpenAI (itinerary copy when enabled). Their
        policies apply to data they process on our behalf.
      </p>
      <h2>Retention and security</h2>
      <p>
        We retain account and trip data while your account is active. You may request deletion by contacting{" "}
        <a href="mailto:hello@viazo.app">hello@viazo.app</a>. We use industry-standard measures but no system is
        perfectly secure.
      </p>
      <h2>Your rights</h2>
      <p>
        Depending on where you live, you may have rights to access, correct, or delete personal data. Contact us to
        exercise these rights.
      </p>
      <h2>Contact</h2>
      <p>
        Email <a href="mailto:hello@viazo.app">hello@viazo.app</a> for privacy questions.
      </p>
    </LegalLayout>
  );
}
