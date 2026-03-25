import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Txartelak · Osakidetza",
  description: "Práctica de exámenes de ofimática con repetición espaciada inteligente — Osakidetza",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "IT Txartelak",
  },
};

export const viewport: Viewport = {
  themeColor: "#282182",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#282182" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="IT Txartelak" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* Anti-FOUC: apply saved theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){try{var t=localStorage.getItem('chatelac_theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}}());
        `}} />
      </head>
      {/* background en inline para que coincida con el CSS var --background */}
      <body className="min-h-screen antialiased" style={{ background: 'var(--background)' }}>
        {children}
      </body>
    </html>
  );
}
