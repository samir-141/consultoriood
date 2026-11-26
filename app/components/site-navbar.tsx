"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { ClinicBrand } from "@/app/components/clinic-brand";
import { PublicIcon } from "@/app/components/public-icon";
import { whatsappUrl } from "@/app/public-content";
import styles from "../landing.module.css";

const navLinks = [
  { href: "#inicio", label: "Inicio" },
  { href: "#servicios", label: "Servicios" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#ubicacion", label: "Ubicación" },
] as const;

export function SiteNavbar() {
  const headerRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const rawMenuId = useId();
  const menuId = `site-menu-${rawMenuId.replace(/:/g, "")}`;
  // Default collapsed so narrow mobile never flashes overflowing inline links
  const [isWide, setIsWide] = useState(false);
  const [menuOpenFallback, setMenuOpenFallback] = useState(false);

  const syncLayout = () => {
    const header = headerRef.current;
    const inner = innerRef.current;
    const menu = menuRef.current;
    if (!header || !inner || !menu) return;

    const supportsPopover = Object.hasOwn(HTMLElement.prototype, "popover");
    const wasOpen = supportsPopover ? menu.matches(":popover-open") : menuOpenFallback;

    header.classList.add(styles.isMeasuring);
    header.classList.add(styles.isWide);
    menu.removeAttribute("popover");

    const fits = inner.scrollWidth <= inner.clientWidth + 1;

    setIsWide(fits);
    if (fits) {
      header.classList.add(styles.isWide);
      menu.removeAttribute("popover");
      setMenuOpenFallback(false);
    } else {
      header.classList.remove(styles.isWide);
      if (supportsPopover) {
        menu.setAttribute("popover", "auto");
        if (wasOpen) {
          try {
            menu.showPopover();
          } catch {
            // Ignore if already open or detached
          }
        }
      }
    }

    requestAnimationFrame(() => {
      header.classList.remove(styles.isMeasuring);
    });
  };

  useLayoutEffect(() => {
    syncLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const header = headerRef.current;
    const menu = menuRef.current;
    if (!header || !menu) return;

    let lastWidth = header.clientWidth;
    const ro = new ResizeObserver(() => {
      const currentWidth = header.clientWidth;
      const currentlyWide = header.classList.contains(styles.isWide);
      if (currentlyWide || currentWidth > lastWidth) {
        syncLayout();
      }
      lastWidth = currentWidth;
    });

    ro.observe(header);
    ro.observe(menu);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && menuOpenFallback) {
        setMenuOpenFallback(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpenFallback]);

  const handleLinkClick = () => {
    const menu = menuRef.current;
    if (!menu) return;
    if (Object.hasOwn(HTMLElement.prototype, "popover") && menu.matches(":popover-open")) {
      try {
        menu.hidePopover();
      } catch {
        // Ignore
      }
    }
    setMenuOpenFallback(false);
  };

  const handleFallbackToggle = () => {
    if (!Object.hasOwn(HTMLElement.prototype, "popover")) {
      setMenuOpenFallback((prev) => !prev);
    }
  };

  return (
    <div className={styles.stickyContainer}>
      <header ref={headerRef} className={`${styles.siteHeader} ${isWide ? styles.isWide : ""}`}>
        <div ref={innerRef} className={`shell ${styles.headerInner}`}>
          <div className={styles.brandSlot}>
            <ClinicBrand href="#inicio" />
          </div>

          <nav className={styles.siteNav} aria-label="Navegación principal">
            <ul
              ref={menuRef}
              id={menuId}
              className={styles.siteMenu}
              data-open={menuOpenFallback ? "true" : undefined}
            >
              {navLinks.map((item) => (
                <li key={item.href}>
                  <a href={item.href} onClick={handleLinkClick}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className={styles.headerActions}>
            <a
              href={whatsappUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.headerAction}
            >
              <PublicIcon name="whatsapp" />
              <span>AGENDA TU CITA</span>
            </a>

            <button
              type="button"
              className={styles.menuButton}
              popoverTarget={menuId}
              popoverTargetAction="toggle"
              aria-controls={menuId}
              aria-label="Abrir menú de navegación"
              onClick={handleFallbackToggle}
            >
              <PublicIcon name="menu" />
            </button>
          </div>
        </div>
      </header>
    </div>
  );
}
