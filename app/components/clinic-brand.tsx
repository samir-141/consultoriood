import Image from "next/image";
import Link from "next/link";
import { clinic } from "@/lib/catalog";

export function ClinicBrand({
  href = "/",
  variant = "default",
}: {
  href?: string;
  variant?: "default" | "light";
}) {
  const isLight = variant === "light";

  return (
    <Link href={href} className={`clinic-brand ${isLight ? "clinic-brand--light" : ""}`}>
      <span className={`clinic-brand-mark ${isLight ? "clinic-brand-mark--light" : ""}`}>
        <Image
          src="/identidad/logo.webp"
          width={48}
          height={48}
          alt=""
          priority={!isLight}
          unoptimized
        />
      </span>
      <span className="clinic-brand-copy">
        <strong translate="no" style={isLight ? { color: "#FFFFFF" } : undefined}>
          {clinic.name}
        </strong>
        <span style={isLight ? { color: "#E9D5EC" } : undefined}>{clinic.descriptor}</span>
      </span>
    </Link>
  );
}
