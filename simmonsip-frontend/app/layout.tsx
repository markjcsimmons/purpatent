import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import AuthGate from "@/components/AuthGate";
import ToastContainer from "@/components/Toast";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Pürpatent",
    template: "%s | Pürpatent",
  },
  description: "Pürpatent trawler and tools",
  icons: [{ rel: "icon", url: "/icon.svg" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${plexSans.variable} ${plexMono.variable} antialiased bg-background text-foreground flex flex-col items-center`}
      >
        <AuthGate>
          <Header />
          <main className="w-full max-w-5xl px-4 pb-12">{children}</main>
        </AuthGate>
        <ToastContainer />
      </body>
    </html>
  );
}
