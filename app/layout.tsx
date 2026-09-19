import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Parley — AI meeting notes",
  description: "Record your Zoom, Meet and Teams calls, get cited AI notes and action items, and search every conversation.",
  openGraph: { title: "Parley", description: "AI meeting notes you can check against the transcript." },
};
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = (await cookies()).get("parley_theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${theme}`} style={{ colorScheme: theme }}>
      <body className="antialiased">
        <TooltipProvider delayDuration={200}>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
