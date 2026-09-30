import "./globals.css";
import type { ReactNode } from "react";
import { Header } from "@/components/Header";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata = {
  title: "MT Estates",
  description: "Trusted platform for rentals, Airbnbs, and property management in Kenya.",
  applicationName: "MT Estates",
  themeColor: "#005B8E",
  appleWebApp: {
    capable: true,
    title: "MT Estates",
    statusBarStyle: "default",
  },
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <PwaRegister />
        <div className="flex min-h-screen flex-col bg-slate-50">
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <footer className="border-t bg-white">
            <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 text-xs text-slate-500">
              <span>© {new Date().getFullYear()} MT Estates. All rights reserved.</span>
              <span>Built for trusted rentals, Airbnbs, and property sales in Kenya.</span>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}

