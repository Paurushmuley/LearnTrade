import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TradeCraft AI — Intelligent Interactive Paper Trading & Strategy Platform',
  description: 'Realistic paper trading simulation with Indian statutory taxes, TradingView charts, and a BYOK AI Trading Coach.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-[#0B0E14] text-slate-100 antialiased selection:bg-blue-600 selection:text-white" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
