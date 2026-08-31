import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { UsuarioProvider } from "@/context/UsuarioContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { AppShell } from "@/components/AppShell";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Impulsa CRM",
  description: "CRM interno de Impulsa Studio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a10" },
  ],
};

// Aplica el tema guardado antes de la hidratación para evitar el parpadeo
// del tema equivocado (FOUC) al cargar la página.
const SCRIPT_TEMA = `
(function () {
  try {
    var guardado = localStorage.getItem("crm-impulsa:theme");
    var oscuro = guardado ? guardado === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (oscuro) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <Script id="tema-inicial" strategy="beforeInteractive">
          {SCRIPT_TEMA}
        </Script>
      </head>
      <body>
        <ThemeProvider>
          <UsuarioProvider>
            <AppShell>{children}</AppShell>
          </UsuarioProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
