import "./base.css";
import type { Viewport } from "next";
import { RootDocument } from "./_components/layout/RootDocument";
import { siteMetadata } from "./_components/layout/SiteMetadata";

export const metadata = siteMetadata;
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument>{children}</RootDocument>;
}
