export function publicSiteOrigin() {
  try {
    const url = new URL(process.env.DENTAL_PUBLIC_URL ?? "");
    return url.protocol === "https:" && !url.username && !url.password ? url.origin : undefined;
  } catch {
    return undefined;
  }
}
