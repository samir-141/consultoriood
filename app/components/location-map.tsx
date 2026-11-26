"use client";

import { useEffect, useRef, useState } from "react";
import { PublicIcon } from "@/app/components/public-icon";
import styles from "../landing.module.css";

export function LocationMap({
  address,
  embedUrl,
  mapUrl,
}: {
  address: string;
  embedUrl: string;
  mapUrl: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoadMap, setShouldLoadMap] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node || shouldLoadMap || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadMap(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [shouldLoadMap]);

  return (
    <div className={styles.mapColumn}>
      <div ref={containerRef} className={styles.mapFrameWrap}>
        {shouldLoadMap ? (
          <iframe
            title={`Mapa de ubicación de Gómez Delgado Clínica Dental en ${address}`}
            src={embedUrl}
            className={styles.mapIframe}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        ) : (
          <div className={styles.mapPlaceholder}>
            <PublicIcon name="location" />
            <strong>{address}</strong>
            <span>Huamanga, Ayacucho, Perú</span>
            <button
              type="button"
              className="button-secondary"
              onClick={() => setShouldLoadMap(true)}
            >
              Cargar mapa interactivo
            </button>
          </div>
        )}
      </div>
      {mapUrl && (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.mapDirectLink}
        >
          <span>Abrir en Google Maps →</span>
        </a>
      )}
    </div>
  );
}
