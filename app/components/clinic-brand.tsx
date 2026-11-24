import Image from "next/image";
import Link from "next/link";
import { clinic } from "@/lib/catalog";

export function ClinicBrand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="clinic-brand">
      <Image src="/identidad/marca.svg" width={44} height={44} alt="" unoptimized />
      <span className="clinic-brand-copy">
        <strong translate="no">{clinic.name}</strong>
        <span>{clinic.descriptor}</span>
      </span>
    </Link>
  );
}
