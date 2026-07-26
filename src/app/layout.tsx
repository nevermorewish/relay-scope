import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { BrowserLoadComplete } from "@/components/browser-load-complete";

export const metadata: Metadata = {
  title: "RelayScope · LLM API 监测台",
  description: "自托管的 AI API、中转站与模型服务监测面板",
};

// 防止主题闪烁：在 HTML 解析前就设置 class
const themeScript = `
(function(){try{var t=localStorage.getItem('relayscope-theme')||localStorage.getItem('rsm-theme');var d=window.matchMedia('(prefers-color-scheme: dark)').matches;if(t==='dark'||(!t&&d)){document.documentElement.classList.add('dark');}}catch(e){}})();
`;

const revealScript = `
(function(){
  window.setTimeout(function(){document.documentElement.classList.remove('relay-loading');},15000);
})();
`;

const loadingStyle = `
html.relay-loading body{overflow:hidden}
#relay-boot-screen{display:none}
html.relay-loading #relay-boot-screen{align-items:center;background:#f5f7f8;color:#1f2933;display:flex;flex-direction:column;gap:18px;inset:0;justify-content:center;position:fixed;z-index:2147483647}
html.dark.relay-loading #relay-boot-screen{background:#171a1d;color:#f3f5f7}
html.relay-loading #relay-app-shell{visibility:hidden}
#relay-boot-logo{background:url('/favicon.ico') center/contain no-repeat;height:72px;width:72px}
#relay-boot-screen strong{font:600 22px/1.2 "Microsoft YaHei UI","Segoe UI",sans-serif;letter-spacing:0}
#relay-boot-spinner{animation:relay-boot-spin .8s linear infinite;border:3px solid #46515b;border-radius:50%;border-top-color:#4096ff;height:22px;width:22px}
#relay-boot-screen span{color:#7b8794;font:14px/1.4 "Microsoft YaHei UI","Segoe UI",sans-serif;letter-spacing:0}
@keyframes relay-boot-spin{to{transform:rotate(360deg)}}
@media(prefers-reduced-motion:reduce){#relay-boot-spinner{animation:none}}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="relay-loading" suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: loadingStyle }} />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: revealScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <BrowserLoadComplete />
        <div id="relay-boot-screen" role="status" aria-label="正在加载监测台">
          <div id="relay-boot-logo" aria-hidden="true" />
          <strong>RelayScope</strong>
          <div id="relay-boot-spinner" aria-hidden="true" />
          <span>正在加载监测台...</span>
        </div>
        <div id="relay-app-shell">
          <ThemeProvider>
            {children}
            <Toaster richColors position="top-right" />
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
