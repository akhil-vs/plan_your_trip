import type { Metadata } from "next";
import { LegalLayout } from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Viazo",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service">
      <p className="lead">Last updated: May 2026</p>
      <p>
        By using Viazo you agree to these terms. If you do not agree, do not use the service.
      </p>
      <h2>Service</h2>
      <p>
        Viazo helps you plan travel routes and itineraries. Features may change; we aim to give reasonable notice of
        material changes where practical.
      </p>
      <h2>Accounts</h2>
      <p>
        You are responsible for your account credentials and activity under your account. You must provide accurate
        information and keep your password secure.
      </p>
      <h2>Subscriptions</h2>
      <p>
        Paid plans are billed through Stripe according to the price shown at checkout. You may cancel via the billing
        portal; access to paid features ends when the subscription period ends unless otherwise stated.
      </p>
      <h2>Your content</h2>
      <p>
        You retain ownership of itineraries you create. You grant us a license to host and display that content so we
        can operate the product (including sharing links you enable).
      </p>
      <h2>Acceptable use</h2>
      <p>
        Do not abuse the service, attempt unauthorized access, scrape at scale, or use Viazo for unlawful purposes.
      </p>
      <h2>Disclaimer</h2>
      <p>
        Travel information and routes are provided for planning convenience only. We do not guarantee accuracy of
        third-party place data, road conditions, or opening hours. You are responsible for your own travel decisions.
      </p>
      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, Viazo is not liable for indirect or consequential damages arising from use of the
        service.
      </p>
      <h2>Contact</h2>
      <p>
        Questions about these terms: <a href="mailto:hello@viazo.app">hello@viazo.app</a>.
      </p>
    </LegalLayout>
  );
}
