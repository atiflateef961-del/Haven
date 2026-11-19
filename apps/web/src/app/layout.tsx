import type { Metadata } from "next";
import type { ReactNode } from "react";
import { headers, cookies } from "next/headers";
import "./globals.css";
import { AmbientBackground } from "@/components/motion/ambient-background";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { isTheme, THEME_COOKIE_NAME, type Theme } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Hostel Management System",
  description: "Hostel operations management application.",
};

const themeBootstrap = `(function(){try{var t=localStorage.getItem('hms-theme');if(t!=='dark'&&t!=='light'){var m=document.cookie.match(/(?:^|;\\s*)hms-theme=(dark|light)(?:;|$)/);t=m?m[1]:null}if(t!=='dark'&&t!=='light')t='light';var r=document.documentElement;r.dataset.theme=t;r.classList.toggle('dark',t==='dark')}catch(_){document.documentElement.dataset.theme='light';document.documentElement.classList.remove('dark')}})();`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const savedTheme = cookieStore.get(THEME_COOKIE_NAME)?.value;
  const defaultTheme: Theme = isTheme(savedTheme) ? savedTheme : "light";
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html
      lang="en"
      data-theme={defaultTheme}
      suppressHydrationWarning
    >
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body>
        <ThemeProvider defaultTheme={defaultTheme}>
          <MotionProvider>
            <AmbientBackground />
            <div className="app-shell">{children}</div>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
