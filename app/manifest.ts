import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taskboard",
    short_name: "Taskboard",
    description: "Bảng quản lý task cá nhân với Kanban và deadline.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#4c72e8",
    lang: "vi",
    icons: [
      { src: "/icon.svg", sizes: "64x64", type: "image/svg+xml" },
      { src: "/apple-icon.svg", sizes: "180x180", type: "image/svg+xml" },
    ],
  };
}
