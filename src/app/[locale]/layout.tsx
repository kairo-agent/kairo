import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import NextTopLoader from 'nextjs-toploader';
import { routing } from '@/i18n/routing';
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "KAIRO - Gestion de Leads con IA",
    template: "%s | KAIRO",
  },
  description: "Sistema de gestion de leads con sub-agentes de IA. El momento correcto para actuar.",
  keywords: ["leads", "CRM", "IA", "ventas", "automatizacion"],
  authors: [{ name: "KAIRO" }],
  icons: {
    icon: "/images/logo-main.png",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

interface LocaleLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({
  children,
  params,
}: LocaleLayoutProps) {
  const { locale } = await params;

  // Enable static rendering
  setRequestLocale(locale);

  // Providing all messages to the client side
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <NextTopLoader
          color="#00E5FF"
          height={3}
          showSpinner={false}
          shadow="0 0 10px #00E5FF, 0 0 5px #00E5FF"
        />
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
