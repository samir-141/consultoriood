import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

function hexToRgb(hex) {
  hex = hex.replace("#", "").trim();
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const num = parseInt(hex, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function parseColor(colorStr) {
  if (!colorStr) return { r: 0, g: 0, b: 0 };
  if (colorStr.startsWith("#")) return hexToRgb(colorStr);
  const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    return { r: parseInt(m[1]), g: parseInt(m[2]), b: parseInt(m[3]) };
  }
  return { r: 255, g: 255, b: 255 };
}

function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function contrastRatio(hex1, hex2) {
  const c1 = parseColor(hex1);
  const c2 = parseColor(hex2);
  const l1 = getLuminance(c1.r, c1.g, c1.b);
  const l2 = getLuminance(c2.r, c2.g, c2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

async function runAudit() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  const results = {
    viewports: [],
    overflowCheckAllWidths: [],
    heroCheck: null,
    paletteTokens: null,
    contrastMetrics: {},
    touchTargets: [],
    assets: [],
    layoutColumns: {},
  };

  const assetRequests = [];
  page.on("response", (res) => {
    const url = res.url();
    assetRequests.push({
      url,
      status: res.status(),
      contentType: res.headers()["content-type"] || "",
      size: res.headers()["content-length"] || null,
    });
  });

  const testViewports = [
    { width: 360, height: 800, name: "360-mobile" },
    { width: 768, height: 1024, name: "768-tablet" },
    { width: 1024, height: 768, name: "1024-desktop-small" },
    { width: 1440, height: 900, name: "1440-desktop-std" },
    { width: 1920, height: 1080, name: "1920-desktop-wide" },
  ];

  for (const vp of testViewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const t0 = performance.now();
    const res = await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });
    const t1 = performance.now();

    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return nav
        ? {
            ttfb: Math.round(nav.responseStart - nav.requestStart),
            domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
            loadEvent: Math.round(nav.loadEventEnd - nav.startTime),
          }
        : null;
    });

    const heroBox = await page.locator("[class*='heroContainer']").boundingBox();
    const overflow = await page.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
        bodyClientWidth: document.body.clientWidth,
        hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });

    results.viewports.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      totalLoadMs: Math.round(t1 - t0),
      status: res.status(),
      performanceTiming: timing,
      heroHeight: heroBox ? Math.round(heroBox.height) : null,
      heroCoversViewport: heroBox ? heroBox.height >= vp.height * 0.9 : false,
      overflow,
    });
  }

  // Check overflow at fine-grained widths from 320px to 1920px
  const checkWidths = [320, 340, 360, 375, 414, 480, 600, 768, 800, 900, 1024, 1200, 1280, 1440, 1600, 1920];
  for (const w of checkWidths) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
    const ov = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    results.overflowCheckAllWidths.push({ width: w, ...ov });
  }

  // Hero content check
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "networkidle" });

  const heroDetails = await page.evaluate(() => {
    const heroEl = document.querySelector("[class*='heroContainer']");
    const docName = document.querySelector("[class*='professionalName']")?.textContent?.trim();
    const docTitle = document.querySelector("[class*='professionalTitle']")?.textContent?.trim();
    const clinicBadge = document.querySelector("[class*='badge']")?.textContent?.trim();
    const headline = document.querySelector("[class*='clinicTagline']")?.textContent?.trim();
    const lead = document.querySelector("[class*='heroLead']")?.textContent?.trim();
    const heroImgBadge = document.querySelector("[class*='heroImageBadge']")?.textContent?.trim();

    // CTA buttons inside hero
    const heroBtns = Array.from(heroEl?.querySelectorAll("a") || []).map((a) => ({
      text: a.textContent.trim(),
      href: a.getAttribute("href"),
      classes: a.className,
      rect: a.getBoundingClientRect(),
    }));

    return {
      docName,
      docTitle,
      clinicBadge,
      headline,
      lead,
      heroImgBadge,
      heroBtns,
      computedHeroHeight: window.getComputedStyle(heroEl).minHeight,
    };
  });
  results.heroCheck = heroDetails;

  // Measure Column Grid across viewports
  for (const [vName, vWidth] of [
    ["mobile-360", 360],
    ["tablet-768", 768],
    ["desktop-1024", 1024],
    ["desktop-1440", 1440],
  ]) {
    await page.setViewportSize({ width: vWidth, height: 900 });
    await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });

    const layout = await page.evaluate(() => {
      const sGrid = document.querySelector("[class*='servicesGrid']");
      const dHighlights = document.querySelector("[class*='doctorHighlights']");
      const lGrid = document.querySelector("[class*='locationGrid']");

      return {
        servicesGridColumns: sGrid ? window.getComputedStyle(sGrid).gridTemplateColumns.split(" ").length : null,
        doctorHighlightsColumns: dHighlights ? window.getComputedStyle(dHighlights).gridTemplateColumns.split(" ").length : null,
        locationGridColumns: lGrid ? window.getComputedStyle(lGrid).gridTemplateColumns.split(" ").length : null,
      };
    });
    results.layoutColumns[vName] = layout;
  }

  // Touch targets inspection
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("http://127.0.0.1:3000", { waitUntil: "domcontentloaded" });
  const touchTargets = await page.evaluate(() => {
    const interactive = Array.from(document.querySelectorAll("a, button, input, select, textarea"));
    return interactive.map((el) => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        tag: el.tagName.toLowerCase(),
        text: el.textContent?.trim().slice(0, 35) || el.getAttribute("aria-label") || el.getAttribute("name") || "",
        href: el.getAttribute("href") || null,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        visible: style.display !== "none" && style.visibility !== "hidden" && rect.height > 0,
        meets44px: rect.height >= 44,
      };
    }).filter((t) => t.visible);
  });
  results.touchTargets = touchTargets;

  // Blue palette tokens & contrast
  const tokens = await page.evaluate(() => {
    const cs = window.getComputedStyle(document.documentElement);
    return {
      blueDeep: cs.getPropertyValue("--blue-deep").trim(),
      blueDark: cs.getPropertyValue("--blue-dark").trim(),
      bluePrimary: cs.getPropertyValue("--blue-primary").trim(),
      blueHover: cs.getPropertyValue("--blue-hover").trim(),
      blueSoft: cs.getPropertyValue("--blue-soft").trim(),
      blueSoftBorder: cs.getPropertyValue("--blue-soft-border").trim(),
      canvas: cs.getPropertyValue("--canvas").trim(),
      ink: cs.getPropertyValue("--ink").trim(),
      muted: cs.getPropertyValue("--muted").trim(),
      paper: cs.getPropertyValue("--paper").trim(),
    };
  });
  results.paletteTokens = tokens;

  // Contrast calculations
  results.contrastMetrics = {
    blueDeepOnWhite: {
      colors: `${tokens.blueDeep} on #ffffff`,
      ratio: Number(contrastRatio(tokens.blueDeep, "#ffffff").toFixed(2)),
      passesAA: contrastRatio(tokens.blueDeep, "#ffffff") >= 4.5,
      passesAAA: contrastRatio(tokens.blueDeep, "#ffffff") >= 7.0,
    },
    bluePrimaryOnWhite: {
      colors: `${tokens.bluePrimary} on #ffffff`,
      ratio: Number(contrastRatio(tokens.bluePrimary, "#ffffff").toFixed(2)),
      passesAA: contrastRatio(tokens.bluePrimary, "#ffffff") >= 4.5,
      passesAAA: contrastRatio(tokens.bluePrimary, "#ffffff") >= 7.0,
    },
    whiteOnBluePrimary: {
      colors: `#ffffff on ${tokens.bluePrimary} (Botón primario)`,
      ratio: Number(contrastRatio("#ffffff", tokens.bluePrimary).toFixed(2)),
      passesAA: contrastRatio("#ffffff", tokens.bluePrimary) >= 4.5,
      passesAAA: contrastRatio("#ffffff", tokens.bluePrimary) >= 7.0,
    },
    inkOnCanvas: {
      colors: `${tokens.ink} on ${tokens.canvas}`,
      ratio: Number(contrastRatio(tokens.ink, tokens.canvas).toFixed(2)),
      passesAA: contrastRatio(tokens.ink, tokens.canvas) >= 4.5,
      passesAAA: contrastRatio(tokens.ink, tokens.canvas) >= 7.0,
    },
    mutedOnWhite: {
      colors: `${tokens.muted} on #ffffff`,
      ratio: Number(contrastRatio(tokens.muted, "#ffffff").toFixed(2)),
      passesAA: contrastRatio(tokens.muted, "#ffffff") >= 4.5,
      passesAAA: contrastRatio(tokens.muted, "#ffffff") >= 7.0,
    },
    bluePrimaryOnBlueSoft: {
      colors: `${tokens.bluePrimary} on ${tokens.blueSoft} (Service button)`,
      ratio: Number(contrastRatio(tokens.bluePrimary, tokens.blueSoft).toFixed(2)),
      passesAA: contrastRatio(tokens.bluePrimary, tokens.blueSoft) >= 4.5,
      passesAAA: contrastRatio(tokens.bluePrimary, tokens.blueSoft) >= 7.0,
    },
  };

  // Filter unique assets
  const uniqueAssets = [];
  const seen = new Set();
  for (const a of assetRequests) {
    if (!seen.has(a.url)) {
      seen.add(a.url);
      uniqueAssets.push(a);
    }
  }
  results.assets = uniqueAssets.filter((a) => !a.url.includes("webpack") && !a.url.includes("hot-reload"));

  await browser.close();

  fs.writeFileSync(
    path.join(process.cwd(), "reports", "detailed-visual-audit.json"),
    JSON.stringify(results, null, 2)
  );

  console.log("Visual audit completed successfully. Written to reports/detailed-visual-audit.json");
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
