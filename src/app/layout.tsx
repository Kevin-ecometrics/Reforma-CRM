import type { Metadata } from "next";
import { Josefin_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "./components/AppShell";

// Reforma Dental's brand kit specifies Josefin Sans as the working body/CTA
// face (paragraphs, checklists, buttons) — it's an open-source Google Font,
// so it's loaded here rather than self-hosted like Rockwell Nova/Gibson.
const josefinSans = Josefin_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Reforma Dental — CRM",
  description: "Lead pipeline and automation center for Reforma Dental",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={josefinSans.className}>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
