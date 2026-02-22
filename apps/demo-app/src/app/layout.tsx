import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

import { Space_Grotesk, JetBrains_Mono, Orbitron } from 'next/font/google';

const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains-mono' });
const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' });

export const metadata: Metadata = {
  title: "OpenFeedback Engine",
  description: "Headless Feedback Infrastructure for Next.js",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} ${orbitron.variable} font-sans`}>
      <body className="bg-[#09090b] text-[#a1a1aa] min-h-screen antialiased flex selection:bg-indigo-500/30">
        <Sidebar />
        <div className="flex-1 flex flex-col h-screen overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto w-full relative">
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:32px_32px]"></div>
            <div className="absolute left-[20%] right-0 top-0 -z-10 m-auto h-[400px] w-[400px] rounded-full bg-indigo-600 opacity-10 blur-[120px]"></div>
            <div className="absolute right-0 top-1/2 -z-10 m-auto h-[300px] w-[300px] rounded-full bg-violet-600 opacity-[0.08] blur-[100px]"></div>
            <div className="relative z-10 w-full h-full max-w-6xl mx-auto p-4 md:p-8 lg:p-12">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
