import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bay Baby Audit",
  description: "Inspection and Primus audit preparation for Bay Baby Produce",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
