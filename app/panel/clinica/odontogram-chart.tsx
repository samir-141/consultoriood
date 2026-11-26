"use client";

import { useState } from "react";
import type {
  OdontogramSnapshot,
  ToothConditionColor,
  ToothRecord,
  ToothSurface,
} from "@/lib/clinical-history";
import styles from "./clinica.module.css";

const UPPER_PERMANENT_RIGHT = ["18", "17", "16", "15", "14", "13", "12", "11"];
const UPPER_PERMANENT_LEFT = ["21", "22", "23", "24", "25", "26", "27", "28"];
const UPPER_DECIDUOUS_RIGHT = ["55", "54", "53", "52", "51"];
const UPPER_DECIDUOUS_LEFT = ["61", "62", "63", "64", "65"];
const LOWER_DECIDUOUS_RIGHT = ["85", "84", "83", "82", "81"];
const LOWER_DECIDUOUS_LEFT = ["71", "72", "73", "74", "75"];
const LOWER_PERMANENT_RIGHT = ["48", "47", "46", "45", "44", "43", "42", "41"];
const LOWER_PERMANENT_LEFT = ["31", "32", "33", "34", "35", "36", "37", "38"];

export type OdontogramTool = {
  id: string;
  label: string;
  shortCode: string;
  color: ToothConditionColor | "clear";
  mode: "surface" | "tooth" | "clear";
};

export const ODONTOGRAM_TOOLS: OdontogramTool[] = [
  { id: "caries", label: "Caries / Lesión (Rojo)", shortCode: "CE", color: "red", mode: "surface" },
  { id: "restauracion-def", label: "Restauración def. (Rojo)", shortCode: "RD", color: "red", mode: "surface" },
  { id: "restauracion-ok", label: "Restauración / Obturado (Azul)", shortCode: "OB", color: "blue", mode: "surface" },
  { id: "sellante", label: "Sellante (Azul)", shortCode: "S", color: "blue", mode: "surface" },
  { id: "endodoncia", label: "Endodoncia / T.C. (Azul)", shortCode: "TC", color: "blue", mode: "tooth" },
  { id: "corona", label: "Corona / Prótesis (Azul)", shortCode: "CD", color: "blue", mode: "tooth" },
  { id: "implante", label: "Implante (Azul)", shortCode: "IM", color: "blue", mode: "tooth" },
  { id: "remanente", label: "Remanente radicular (Rojo)", shortCode: "RR", color: "red", mode: "tooth" },
  { id: "extraccion", label: "Extracción indicada (Rojo)", shortCode: "EX", color: "red", mode: "tooth" },
  { id: "ausente", label: "Pieza ausente (Negro)", shortCode: "X", color: "neutral", mode: "tooth" },
  { id: "limpiar", label: "Limpiar pieza / superficie", shortCode: "", color: "clear", mode: "clear" },
];

const COLOR_HEX: Record<ToothConditionColor, string> = {
  red: "#dc2626",
  blue: "#2563eb",
  neutral: "#1e293b",
};

function surfaceFill(color?: ToothConditionColor): string {
  if (!color) return "#ffffff";
  if (color === "red") return "#ef4444";
  if (color === "blue") return "#3b82f6";
  return "#475569";
}

function getRootCount(fdi: string): number {
  const num = Number(fdi) % 10;
  const quad = Math.floor(Number(fdi) / 10);
  if (num >= 6) return quad === 1 || quad === 2 || quad === 5 || quad === 6 ? 3 : 2;
  if (num === 4 || num === 5) return quad === 1 || quad === 2 ? 2 : 1;
  return 1;
}

type ToothCellProps = Readonly<{
  fdi: string;
  isUpper: boolean;
  record?: ToothRecord;
  editable: boolean;
  selected: boolean;
  onSelectTooth: (fdi: string) => void;
  onSurfaceClick: (fdi: string, surface: ToothSurface) => void;
  onCodeBoxClick: (fdi: string) => void;
}>;

function ToothCell({
  fdi,
  isUpper,
  record,
  editable,
  selected,
  onSelectTooth,
  onSurfaceClick,
  onCodeBoxClick,
}: ToothCellProps) {
  const roots = getRootCount(fdi);
  const quad = Math.floor(Number(fdi) / 10);
  const isRightSideOfPatient = quad === 1 || quad === 4 || quad === 5 || quad === 8;
  // On dental charts facing the patient: left side of chart = mesial on right quadrants, distal on left quadrants
  const leftSurface: ToothSurface = isRightSideOfPatient ? "D" : "M";
  const rightSurface: ToothSurface = isRightSideOfPatient ? "M" : "D";
  const topSurface: ToothSurface = isUpper ? "V" : "L";
  const bottomSurface: ToothSurface = isUpper ? "L" : "V";

  const surfaces = record?.surfaces ?? {};
  const codeColor = record?.color ? COLOR_HEX[record.color] : "#3b1143";
  const isAbsent = record?.code === "X" || record?.code === "EX";
  const isRootCanal = record?.code === "TC";

  const codeBox = (
    <button
      type="button"
      className={`${styles.odonCodeBox} ${selected ? styles.odonCodeSelected : ""}`}
      style={record?.code ? { color: codeColor, borderColor: codeColor } : undefined}
      onClick={() => (editable ? onCodeBoxClick(fdi) : onSelectTooth(fdi))}
      title={`Pieza ${fdi}${record?.code ? ` (${record.code})` : ""}`}
      aria-label={`Pieza ${fdi}${record?.code ? `, código ${record.code}` : ""}`}
    >
      {record?.code || "\u00A0"}
    </button>
  );

  const rootSvg = (
    <svg viewBox="0 0 36 22" className={styles.odonRootSvg} aria-hidden="true">
      {isUpper ? (
        roots === 3 ? (
          <>
            <polygon points="4,22 10,3 15,22" fill="none" stroke="#64748b" strokeWidth="1.3" />
            <polygon points="13,22 18,2 23,22" fill="none" stroke="#64748b" strokeWidth="1.3" />
            <polygon points="21,22 26,3 32,22" fill="none" stroke="#64748b" strokeWidth="1.3" />
          </>
        ) : roots === 2 ? (
          <>
            <polygon points="6,22 12,3 18,22" fill="none" stroke="#64748b" strokeWidth="1.3" />
            <polygon points="18,22 24,3 30,22" fill="none" stroke="#64748b" strokeWidth="1.3" />
          </>
        ) : (
          <polygon points="9,22 18,2 27,22" fill="none" stroke="#64748b" strokeWidth="1.3" />
        )
      ) : roots >= 2 ? (
        <>
          <polygon points="6,0 12,19 18,0" fill="none" stroke="#64748b" strokeWidth="1.3" />
          <polygon points="18,0 24,19 30,0" fill="none" stroke="#64748b" strokeWidth="1.3" />
        </>
      ) : (
        <polygon points="9,0 18,20 27,0" fill="none" stroke="#64748b" strokeWidth="1.3" />
      )}
      {isRootCanal ? (
        <line x1="18" y1="3" x2="18" y2="19" stroke="#2563eb" strokeWidth="2.4" strokeLinecap="round" />
      ) : null}
    </svg>
  );

  const crownSvg = (
    <svg viewBox="0 0 36 36" className={styles.odonCrownSvg} role="group" aria-label={`Superficies pieza ${fdi}`}>
      {/* Top */}
      <polygon
        points="2,2 34,2 26,10 10,10"
        fill={surfaceFill(surfaces[topSurface])}
        stroke="#475569"
        strokeWidth="1.2"
        className={editable ? styles.odonSurfaceInteractive : undefined}
        onClick={() => (editable ? onSurfaceClick(fdi, topSurface) : onSelectTooth(fdi))}
      >
        <title>{`Pieza ${fdi} · ${topSurface}`}</title>
      </polygon>
      {/* Right */}
      <polygon
        points="34,2 34,34 26,26 26,10"
        fill={surfaceFill(surfaces[rightSurface])}
        stroke="#475569"
        strokeWidth="1.2"
        className={editable ? styles.odonSurfaceInteractive : undefined}
        onClick={() => (editable ? onSurfaceClick(fdi, rightSurface) : onSelectTooth(fdi))}
      >
        <title>{`Pieza ${fdi} · ${rightSurface}`}</title>
      </polygon>
      {/* Bottom */}
      <polygon
        points="34,34 2,34 10,26 26,26"
        fill={surfaceFill(surfaces[bottomSurface])}
        stroke="#475569"
        strokeWidth="1.2"
        className={editable ? styles.odonSurfaceInteractive : undefined}
        onClick={() => (editable ? onSurfaceClick(fdi, bottomSurface) : onSelectTooth(fdi))}
      >
        <title>{`Pieza ${fdi} · ${bottomSurface}`}</title>
      </polygon>
      {/* Left */}
      <polygon
        points="2,34 2,2 10,10 10,26"
        fill={surfaceFill(surfaces[leftSurface])}
        stroke="#475569"
        strokeWidth="1.2"
        className={editable ? styles.odonSurfaceInteractive : undefined}
        onClick={() => (editable ? onSurfaceClick(fdi, leftSurface) : onSelectTooth(fdi))}
      >
        <title>{`Pieza ${fdi} · ${leftSurface}`}</title>
      </polygon>
      {/* Center Occlusal / Incisal */}
      <rect
        x="10"
        y="10"
        width="16"
        height="16"
        fill={surfaceFill(surfaces.O)}
        stroke="#475569"
        strokeWidth="1.2"
        className={editable ? styles.odonSurfaceInteractive : undefined}
        onClick={() => (editable ? onSurfaceClick(fdi, "O") : onSelectTooth(fdi))}
      >
        <title>{`Pieza ${fdi} · Oclusal/Incisal`}</title>
      </rect>
      {isAbsent ? (
        <g stroke={record?.code === "EX" ? "#dc2626" : "#1e293b"} strokeWidth="2.6" pointerEvents="none">
          <line x1="4" y1="4" x2="32" y2="32" />
          <line x1="32" y1="4" x2="4" y2="32" />
        </g>
      ) : null}
      {record?.code === "CD" ? (
        <rect
          x="3"
          y="3"
          width="30"
          height="30"
          rx="3"
          fill="none"
          stroke="#2563eb"
          strokeWidth="2.2"
          pointerEvents="none"
        />
      ) : null}
    </svg>
  );

  return (
    <div className={`${styles.odonTooth} ${selected ? styles.odonToothSelected : ""}`}>
      {isUpper ? (
        <>
          {codeBox}
          <span className={styles.odonFdi}>{fdi}</span>
          {rootSvg}
          {crownSvg}
        </>
      ) : (
        <>
          {crownSvg}
          {rootSvg}
          <span className={styles.odonFdi}>{fdi}</span>
          {codeBox}
        </>
      )}
    </div>
  );
}

type OdontogramChartProps = Readonly<{
  title: string;
  snapshot: OdontogramSnapshot;
  editable?: boolean;
  onChange?: (next: OdontogramSnapshot) => void;
}>;

export function OdontogramChart({ title, snapshot, editable = false, onChange }: OdontogramChartProps) {
  const [activeToolId, setActiveToolId] = useState<string>("caries");
  const [selectedTooth, setSelectedTooth] = useState<string>("");

  const activeTool = ODONTOGRAM_TOOLS.find((t) => t.id === activeToolId) ?? ODONTOGRAM_TOOLS[0];

  function updateTooth(fdi: string, updater: (prev: ToothRecord) => ToothRecord | null) {
    if (!onChange) return;
    const prev = snapshot.teeth[fdi] ?? {};
    const nextRecord = updater(prev);
    const nextTeeth = { ...snapshot.teeth };
    if (!nextRecord) {
      delete nextTeeth[fdi];
    } else {
      nextTeeth[fdi] = nextRecord;
    }
    onChange({ ...snapshot, teeth: nextTeeth });
  }

  function handleSurfaceClick(fdi: string, surface: ToothSurface) {
    setSelectedTooth(fdi);
    if (!editable || !onChange) return;
    updateTooth(fdi, (prev) => {
      if (activeTool.mode === "clear") {
        const nextSurfaces = { ...(prev.surfaces ?? {}) };
        delete nextSurfaces[surface];
        if (Object.keys(nextSurfaces).length === 0 && !prev.code && !prev.note) return null;
        return { ...prev, surfaces: nextSurfaces };
      }
      if (activeTool.mode === "tooth") {
        const same = prev.code === activeTool.shortCode;
        return {
          ...prev,
          code: same ? undefined : activeTool.shortCode,
          color: same ? undefined : (activeTool.color as ToothConditionColor),
        };
      }
      const nextSurfaces = { ...(prev.surfaces ?? {}) };
      if (nextSurfaces[surface] === activeTool.color) {
        delete nextSurfaces[surface];
      } else {
        nextSurfaces[surface] = activeTool.color as ToothConditionColor;
      }
      return {
        ...prev,
        surfaces: nextSurfaces,
        code: prev.code || activeTool.shortCode,
        color: prev.color || (activeTool.color as ToothConditionColor),
      };
    });
  }

  function handleCodeBoxClick(fdi: string) {
    setSelectedTooth(fdi);
    if (!editable || !onChange) return;
    updateTooth(fdi, (prev) => {
      if (activeTool.mode === "clear") return null;
      const same = prev.code === activeTool.shortCode;
      const nextCode = same ? undefined : activeTool.shortCode;
      const nextColor = same ? undefined : (activeTool.color as ToothConditionColor);
      if (!nextCode && !prev.note && (!prev.surfaces || Object.keys(prev.surfaces).length === 0)) {
        return null;
      }
      return { ...prev, code: nextCode, color: nextColor };
    });
  }

  const annotatedTeeth = Object.entries(snapshot.teeth).sort(([a], [b]) => Number(a) - Number(b));
  const selectedRecord = selectedTooth ? snapshot.teeth[selectedTooth] : undefined;

  return (
    <div className={styles.odonContainer}>
      <div className={styles.odonHeader}>
        <div>
          <span className={styles.odonNorma}>NTS N° 188-MINSA/DGIESP-2022 · Norma Técnica de Salud para el uso del Odontograma</span>
          <h3 className={styles.odonTitle}>{title}</h3>
        </div>
        {editable && onChange ? (
          <label className={styles.odonDateField}>
            <span>Fecha:</span>
            <input
              type="date"
              className={styles.input}
              value={snapshot.date}
              onChange={(event) => onChange({ ...snapshot, date: event.target.value })}
            />
          </label>
        ) : (
          <span className={styles.meta}>Fecha: {snapshot.date || "Sin registrar"}</span>
        )}
      </div>

      {editable ? (
        <div className={styles.odonPalette} role="toolbar" aria-label="Herramientas del odontograma">
          {ODONTOGRAM_TOOLS.map((tool) => {
            const active = tool.id === activeToolId;
            return (
              <button
                key={tool.id}
                type="button"
                aria-pressed={active}
                onClick={() => setActiveToolId(tool.id)}
                className={`${styles.odonToolBtn} ${active ? styles.odonToolBtnActive : ""}`}
              >
                {tool.color !== "clear" ? (
                  <span
                    className={styles.odonSwatch}
                    style={{ backgroundColor: COLOR_HEX[tool.color] }}
                    aria-hidden="true"
                  />
                ) : null}
                <span>{tool.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}

      <div className={styles.odonScroll} tabIndex={0} role="region" aria-label={`${title} por piezas FDI`}>
        <div className={styles.odonChartGrid}>
          {/* Arcada Superior Permanente: 18..11 | 21..28 */}
          <div className={styles.odonRow}>
            <div className={styles.odonHalfRight}>
              {UPPER_PERMANENT_RIGHT.map((fdi) => (
                <ToothCell
                  key={fdi}
                  fdi={fdi}
                  isUpper
                  record={snapshot.teeth[fdi]}
                  editable={editable}
                  selected={selectedTooth === fdi}
                  onSelectTooth={setSelectedTooth}
                  onSurfaceClick={handleSurfaceClick}
                  onCodeBoxClick={handleCodeBoxClick}
                />
              ))}
            </div>
            <div className={styles.odonMidline} aria-hidden="true" />
            <div className={styles.odonHalfLeft}>
              {UPPER_PERMANENT_LEFT.map((fdi) => (
                <ToothCell
                  key={fdi}
                  fdi={fdi}
                  isUpper
                  record={snapshot.teeth[fdi]}
                  editable={editable}
                  selected={selectedTooth === fdi}
                  onSelectTooth={setSelectedTooth}
                  onSurfaceClick={handleSurfaceClick}
                  onCodeBoxClick={handleCodeBoxClick}
                />
              ))}
            </div>
          </div>

          {/* Arcada Superior Temporal: 55..51 | 61..65 */}
          <div className={`${styles.odonRow} ${styles.odonRowDeciduous}`}>
            <div className={styles.odonHalfRight}>
              {UPPER_DECIDUOUS_RIGHT.map((fdi) => (
                <ToothCell
                  key={fdi}
                  fdi={fdi}
                  isUpper
                  record={snapshot.teeth[fdi]}
                  editable={editable}
                  selected={selectedTooth === fdi}
                  onSelectTooth={setSelectedTooth}
                  onSurfaceClick={handleSurfaceClick}
                  onCodeBoxClick={handleCodeBoxClick}
                />
              ))}
            </div>
            <div className={styles.odonMidline} aria-hidden="true" />
            <div className={styles.odonHalfLeft}>
              {UPPER_DECIDUOUS_LEFT.map((fdi) => (
                <ToothCell
                  key={fdi}
                  fdi={fdi}
                  isUpper
                  record={snapshot.teeth[fdi]}
                  editable={editable}
                  selected={selectedTooth === fdi}
                  onSelectTooth={setSelectedTooth}
                  onSurfaceClick={handleSurfaceClick}
                  onCodeBoxClick={handleCodeBoxClick}
                />
              ))}
            </div>
          </div>

          <div className={styles.odonOcclusalDivider} />

          {/* Arcada Inferior Temporal: 85..81 | 71..75 */}
          <div className={`${styles.odonRow} ${styles.odonRowDeciduous}`}>
            <div className={styles.odonHalfRight}>
              {LOWER_DECIDUOUS_RIGHT.map((fdi) => (
                <ToothCell
                  key={fdi}
                  fdi={fdi}
                  isUpper={false}
                  record={snapshot.teeth[fdi]}
                  editable={editable}
                  selected={selectedTooth === fdi}
                  onSelectTooth={setSelectedTooth}
                  onSurfaceClick={handleSurfaceClick}
                  onCodeBoxClick={handleCodeBoxClick}
                />
              ))}
            </div>
            <div className={styles.odonMidline} aria-hidden="true" />
            <div className={styles.odonHalfLeft}>
              {LOWER_DECIDUOUS_LEFT.map((fdi) => (
                <ToothCell
                  key={fdi}
                  fdi={fdi}
                  isUpper={false}
                  record={snapshot.teeth[fdi]}
                  editable={editable}
                  selected={selectedTooth === fdi}
                  onSelectTooth={setSelectedTooth}
                  onSurfaceClick={handleSurfaceClick}
                  onCodeBoxClick={handleCodeBoxClick}
                />
              ))}
            </div>
          </div>

          {/* Arcada Inferior Permanente: 48..41 | 31..38 */}
          <div className={styles.odonRow}>
            <div className={styles.odonHalfRight}>
              {LOWER_PERMANENT_RIGHT.map((fdi) => (
                <ToothCell
                  key={fdi}
                  fdi={fdi}
                  isUpper={false}
                  record={snapshot.teeth[fdi]}
                  editable={editable}
                  selected={selectedTooth === fdi}
                  onSelectTooth={setSelectedTooth}
                  onSurfaceClick={handleSurfaceClick}
                  onCodeBoxClick={handleCodeBoxClick}
                />
              ))}
            </div>
            <div className={styles.odonMidline} aria-hidden="true" />
            <div className={styles.odonHalfLeft}>
              {LOWER_PERMANENT_LEFT.map((fdi) => (
                <ToothCell
                  key={fdi}
                  fdi={fdi}
                  isUpper={false}
                  record={snapshot.teeth[fdi]}
                  editable={editable}
                  selected={selectedTooth === fdi}
                  onSelectTooth={setSelectedTooth}
                  onSurfaceClick={handleSurfaceClick}
                  onCodeBoxClick={handleCodeBoxClick}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {editable && selectedTooth && onChange ? (
        <div className={styles.odonInspector}>
          <strong>Pieza {selectedTooth}</strong>
          <div className={styles.twoColumns}>
            <label className={styles.field}>
              <span>Sigla / Código</span>
              <input
                className={styles.input}
                maxLength={12}
                value={selectedRecord?.code ?? ""}
                onChange={(event) => {
                  const code = event.target.value.toUpperCase();
                  updateTooth(selectedTooth, (prev) => {
                    if (!code && !prev.note && (!prev.surfaces || Object.keys(prev.surfaces).length === 0)) return null;
                    return { ...prev, code: code || undefined, color: prev.color ?? "red" };
                  });
                }}
                placeholder="Ej. CE, OB, TC, CD, X"
              />
            </label>
            <label className={styles.field}>
              <span>Nota rápida de pieza</span>
              <input
                className={styles.input}
                maxLength={250}
                value={selectedRecord?.note ?? ""}
                onChange={(event) => {
                  const note = event.target.value;
                  updateTooth(selectedTooth, (prev) => {
                    if (!note && !prev.code && (!prev.surfaces || Object.keys(prev.surfaces).length === 0)) return null;
                    return { ...prev, note: note || undefined };
                  });
                }}
                placeholder="Ej. Caries oclusal profunda"
              />
            </label>
          </div>
        </div>
      ) : null}

      {annotatedTeeth.length > 0 ? (
        <div className={styles.odonSummaryChips}>
          {annotatedTeeth.map(([fdi, item]) => {
            const surfList = Object.keys(item.surfaces ?? {}).join(",");
            return (
              <span key={fdi} className={styles.odonChip}>
                <strong>P.{fdi}</strong>
                {item.code ? ` ${item.code}` : ""}
                {surfList ? ` (${surfList})` : ""}
                {item.note ? `: ${item.note}` : ""}
              </span>
            );
          })}
        </div>
      ) : (
        <p className={styles.empty}>Sin hallazgos marcados en este odontograma.</p>
      )}

      {editable && onChange ? (
        <div className={styles.twoColumns}>
          <label className={styles.field}>
            <span>Especificaciones</span>
            <textarea
              className={styles.textarea}
              rows={2}
              value={snapshot.specifications}
              onChange={(event) => onChange({ ...snapshot, specifications: event.target.value })}
              placeholder="Ej. Piezas con movilidad, malposición, prótesis fija..."
            />
          </label>
          <label className={styles.field}>
            <span>Observaciones</span>
            <textarea
              className={styles.textarea}
              rows={2}
              value={snapshot.observations}
              onChange={(event) => onChange({ ...snapshot, observations: event.target.value })}
              placeholder="Observaciones adicionales del odontograma..."
            />
          </label>
        </div>
      ) : (
        (snapshot.specifications || snapshot.observations) ? (
          <div className={styles.twoColumns}>
            <div>
              <span className={styles.meta}>Especificaciones</span>
              <p className={styles.readValue}>{snapshot.specifications || "—"}</p>
            </div>
            <div>
              <span className={styles.meta}>Observaciones</span>
              <p className={styles.readValue}>{snapshot.observations || "—"}</p>
            </div>
          </div>
        ) : null
      )}
    </div>
  );
}
