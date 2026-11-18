import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { AmbientBackground } from "@/components/motion/ambient-background";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";

export const metadata: Metadata = {
  title: "Hostel Management System",
  description: "Hostel operations management application.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider initialTheme="light">
          <MotionProvider>
            <AmbientBackground />
            <div className="app-shell">{children}</div>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
