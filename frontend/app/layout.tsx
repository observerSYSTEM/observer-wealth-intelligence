import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { PWARegister } from "@/components/pwa-register";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  title: "Observer Wealth Intelligence",
  description: "Private wealth intelligence dashboard",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Observer Wealth",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  themeColor: "#3D5A40"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <PWARegister />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
