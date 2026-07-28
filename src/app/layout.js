import "./globals.css";
import Providers from "@/components/Providers";

export const metadata = {
  title: "Your Library — Video Library",
  description: "Your videos. In your Drive.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-paper text-ink font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
