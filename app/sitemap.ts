import type { MetadataRoute } from "next";
import { publicServices } from "./public-content";
import { publicSiteOrigin } from "./public-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = publicSiteOrigin();
  if (!origin) return [];

  return [
    { url: origin },
    ...publicServices.map(({ id }) => ({ url: new URL(`/servicios/${id}`, origin).href })),
  ];
}
