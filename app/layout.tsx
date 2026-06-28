import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChapterFlow",
  description: "A book chapter submission and editorial workflow platform."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
