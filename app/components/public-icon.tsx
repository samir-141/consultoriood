const strokes: Record<string, string> = {
  arrow: "M4 12h15m-6-6 6 6-6 6",
  calendar: "M7 3v4m10-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 10 2 2 4-4",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  location: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  evaluacion: "M15.5 9.5a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.75 4.25L20.5 20.5M7 9.5h5M9.5 7v5",
  limpieza: "M13 2c0 5 2 7 7 7-5 0-7 2-7 7 0-5-2-7-7-7 5 0 7-2 7-7ZM5 13v6m-3-3h6m12-1v6m-3-3h6",
  control: "M20 11a8 8 0 1 0-2 6m2-11v5h-5m1 10 2 2 4-4",
  professional: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2",
  phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z",
  mail: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  check: "M20 6L9 17l-5-5",
  tooth: "M12 2C9.5 2 7.5 3.5 7 5.5c-.8 3-2 6-2 9 0 4 2.5 7.5 5 7.5 1.5 0 2-2 2-4 0 2 .5 4 2 4 2.5 0 5-3.5 5-7.5 0-3-1.2-6-2-9-.5-2-2.5-3.5-5-3.5z",
};

export function PublicIcon({ name }: { name: string }) {
  const path = strokes[name] ?? strokes.evaluacion;
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}
