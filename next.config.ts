import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "mammoth", "xlsx"],
};
export default config;
