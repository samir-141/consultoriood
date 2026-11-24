import Image from "next/image";
import styles from "./booking.module.css";

const illustrations = {
  saludo: "/identidad/gomita-saludo.svg",
  pensando: "/identidad/gomita-pensando.svg",
  exito: "/identidad/gomita-exito.svg",
} as const;

type GomitaProps = {
  pose: keyof typeof illustrations;
  compact?: boolean;
};

export function Gomita({ pose, compact = false }: GomitaProps) {
  const priority = pose === "saludo" && !compact;

  return (
    <figure className={compact ? `${styles.art} ${styles.artCompact}` : styles.art} aria-hidden="true">
      <div className={styles.artMotion} data-pose={pose} key={pose}>
        <Image
          src={illustrations[pose]}
          width={320}
          height={280}
          alt=""
          unoptimized
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : undefined}
        />
      </div>
    </figure>
  );
}
