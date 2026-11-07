import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs", "jspdf", "jspdf-autotable"],
};

export default nextConfig;
