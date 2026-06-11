import type { Metadata, Viewport } from "next"
import "@fontsource/anton"
import "@fontsource/barlow/400.css"
import "@fontsource/barlow/500.css"
import "@fontsource/barlow/600.css"
import "@fontsource/barlow-condensed/500.css"
import "@fontsource/barlow-condensed/600.css"
import "@fontsource-variable/jetbrains-mono"
import "./globals.css"
import { BottomNav } from "@/components/bottom-nav"
import { PWARegister } from "@/components/pwa-register"

export const metadata: Metadata = {
  title: "GYM//TRACK — Felipe",
  description:
    "Tracker do plano de treino: Upper/Lower, Zona 2 e recomposição corporal",
  manifest: "/manifest.webmanifest",
  applicationName: "GYM//TRACK",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GYM//TRACK",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/icon-192.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#0b0a0c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh">
        <div className="mx-auto w-full max-w-md px-4 pb-28 pt-5 md:max-w-2xl">
          {children}
        </div>
        <BottomNav />
        <PWARegister />
      </body>
    </html>
  )
}
