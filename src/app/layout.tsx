import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { UsuarioProvider } from "@/context/UsuarioContext";
import { AppShell } from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Impulsa CRM",
  description: "CRM interno de Impulsa Studio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body>
        <UsuarioProvider>
          <AppShell>{children}</AppShell>
        </UsuarioProvider>
      </body>
    </html>
  );
}
