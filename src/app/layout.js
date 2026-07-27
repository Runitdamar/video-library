import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "The Shelf — Video Library",
  description: "Your personal video catalog, backed by Google Drive.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Bitter:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-paper text-ink font-mono">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
