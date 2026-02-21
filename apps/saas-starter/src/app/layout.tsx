import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { OpenFeedbackProvider } from "@openfeedback/react";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SaaS Starter | OpenFeedback",
  description: "A push-to-deploy SaaS B2B template powered by OpenFeedback Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-app-base text-app-primary flex overflow-hidden`}>
        {/* We inject the provider at the root level so any page can render the Board */}
        <OpenFeedbackProvider
          config={{
            projectId: "your-project-id",
            apiUrl: process.env.NEXT_PUBLIC_OPENFEEDBACK_URL!
          }}
          anonKey={process.env.NEXT_PUBLIC_OPENFEEDBACK_ANON_KEY!}
          authContext={{ userId: "simulated-user-123", nonce: "demo", signature: "demo", timestamp: 0 }}
        >
          <Sidebar />
          <div className="flex-1 flex flex-col h-screen overflow-hidden">
            <Header />
            <main className="flex-1 overflow-y-auto p-6 md:p-10 relative">
              {/* Subtle ambient light effect */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
              <div className="relative z-10 max-w-6xl mx-auto">
                {children}
              </div>
            </main>
          </div>
        </OpenFeedbackProvider>
      </body>
    </html >
  );
}
