import path from "node:path";
import { defineConfig } from "@rspress/core";

export default defineConfig({
  root: "docs",
  title: "pi-mono-master",
  icon: "/logo.svg",
  logo: "/logo.svg",
  logoText: "pi-mono-master",
  description:
    "Progressive tutorial for building AI agents with pi-coding-agent",
  globalStyles: path.join(__dirname, "styles/index.css"),
  locales: [
    {
      lang: "en",
      label: "English",
    },
    {
      lang: "zh",
      label: "简体中文",
    },
  ],
  themeConfig: {
    socialLinks: [
      {
        icon: "github",
        mode: "link",
        content: "https://github.com/founddream/pi-mono-master",
      },
    ],
    footer: {
      message: "Built with ❤️",
    },
  },
});
