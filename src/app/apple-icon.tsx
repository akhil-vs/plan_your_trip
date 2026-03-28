import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

/** Apple touch icon: pin + Viazo, scaled for 180×180 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          background: "#ffffff",
          padding: 14,
        }}
      >
        <svg
          width="72"
          height="72"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M24 6c-5.5 0-10 4.3-10 9.6 0 7.2 10 20.4 10 20.4s10-13.2 10-20.4C34 10.3 29.5 6 24 6z"
            stroke="#2563eb"
            strokeWidth="2.5"
            fill="none"
            strokeLinejoin="round"
          />
          <path
            d="M18 22c2.5-2 5.5-2 8 0 2.5 2 6 2 10-1"
            stroke="#2563eb"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <circle cx="24" cy="17" r="2.5" fill="#2563eb" />
        </svg>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: "#0f172a",
            fontSize: 46,
            fontWeight: 700,
            fontFamily:
              'ui-sans-serif, system-ui, "Plus Jakarta Sans", Inter, sans-serif',
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          Viazo
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
