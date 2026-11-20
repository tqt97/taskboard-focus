import "./globals.css";
import { RootDocument } from "./_components/layout/RootDocument";
import { siteMetadata } from "./_components/layout/SiteMetadata";

export const metadata = siteMetadata;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <RootDocument>{children}</RootDocument>;
}
