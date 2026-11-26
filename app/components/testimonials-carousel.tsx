"use client";

import { useEffect, useRef, useState } from "react";
import { PublicIcon } from "@/app/components/public-icon";
import { patientTestimonials } from "@/app/public-content";
import styles from "../landing.module.css";

export function TestimonialsCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const settledIndexRef = useRef(0);

  const getNearestIndex = () => {
    const track = trackRef.current;
    if (!track) return 0;
    const slides = Array.from(track.children) as HTMLElement[];
    if (slides.length === 0) return 0;

    const trackCenter = track.scrollLeft + track.clientWidth / 2;
    let closestIdx = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide, index) => {
      const slideCenter = slide.offsetLeft + slide.offsetWidth / 2;
      const distance = Math.abs(trackCenter - slideCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIdx = index;
      }
    });
    return closestIdx;
  };

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let rafId = 0;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const hasScrollEnd = "onscrollend" in window;

    const handleSettle = () => {
      const idx = getNearestIndex();
      setActiveIndex(idx);
      if (idx !== settledIndexRef.current) {
        settledIndexRef.current = idx;
        setAnnouncement(`Testimonio ${idx + 1} de ${patientTestimonials.length}`);
      }
    };

    const handleScroll = () => {
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          rafId = 0;
          const idx = getNearestIndex();
          setActiveIndex((prev) => (prev === idx ? prev : idx));
        });
      }
      if (!hasScrollEnd) {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(handleSettle, 140);
      }
    };

    track.addEventListener("scroll", handleScroll, { passive: true });
    if (hasScrollEnd) {
      track.addEventListener("scrollend", handleSettle);
    }

    return () => {
      track.removeEventListener("scroll", handleScroll);
      if (hasScrollEnd) {
        track.removeEventListener("scrollend", handleSettle);
      }
      if (rafId) cancelAnimationFrame(rafId);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, []);

  const scrollToSlide = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = track.children[index] as HTMLElement | undefined;
    if (!target) return;

    setActiveIndex(index);
    const left = target.offsetLeft - (track.clientWidth - target.offsetWidth) / 2;
    track.scrollTo({ left });
  };

  return (
    <div
      className={styles.testimonialsCarousel}
      role="region"
      aria-roledescription="carousel"
      aria-label="Testimonios de pacientes"
    >
      <div
        ref={trackRef}
        className={styles.testimonialsTrack}
        tabIndex={0}
        role="group"
        aria-label="Reseñas de pacientes"
      >
        {patientTestimonials.map((item, idx) => (
          <article
            key={item.id}
            className={styles.testimonialCard}
            role="group"
            aria-roledescription="slide"
            aria-label={`${idx + 1} de ${patientTestimonials.length}`}
          >
            <div className={styles.starsRow} aria-label="Calificación de 5 estrellas">
              {[0, 1, 2, 3, 4].map((star) => (
                <PublicIcon key={star} name="star" />
              ))}
            </div>
            <blockquote className={styles.testimonialQuote}>“{item.quote}”</blockquote>
            <footer className={styles.testimonialAuthor}>
              <strong>{item.author}</strong>
              <span>— {item.treatment}</span>
            </footer>
          </article>
        ))}
      </div>

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>

      <nav className={styles.carouselMarkers} aria-label="Elegir testimonio">
        {patientTestimonials.map((item, idx) => (
          <button
            key={item.id}
            type="button"
            className={styles.markerButton}
            aria-label={`Ir al testimonio ${idx + 1}: ${item.author}`}
            aria-current={activeIndex === idx ? "true" : undefined}
            onClick={() => scrollToSlide(idx)}
          >
            <span className={styles.markerDot} aria-hidden="true" />
          </button>
        ))}
      </nav>
    </div>
  );
}
