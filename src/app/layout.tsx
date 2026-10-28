import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "مِرآة — اعرف كيف يراك زبائنك",
  description:
    "زبون سري بالذكاء الاصطناعي يتواصل مع شركتك عبر واتساب والموقع والبريد، ويريك ما يراه زبائنك فعلاً.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
