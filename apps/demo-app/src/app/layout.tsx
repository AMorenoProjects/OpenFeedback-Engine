import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenFeedback Demo",
  description: "Demo app to validate the OpenFeedback Engine core",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-of-neutral-50 text-of-neutral-900 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
