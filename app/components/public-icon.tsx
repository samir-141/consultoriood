const strokes = {
  arrow: "M4 12h15m-6-6 6 6-6 6",
  calendar: "M7 3v4m10-4v4M4 10h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 10 2 2 4-4",
  clock: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM12 7v5l3 2",
  location: "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z",
  evaluacion: "M15.5 9.5a6 6 0 1 1-12 0 6 6 0 0 1 12 0Zm-1.75 4.25L20.5 20.5M7 9.5h5M9.5 7v5",
  limpieza: "M13 2c0 5 2 7 7 7-5 0-7 2-7 7 0-5-2-7-7-7 5 0 7-2 7-7ZM5 13v6m-3-3h6m12-1v6m-3-3h6",
  control: "M20 11a8 8 0 1 0-2 6m2-11v5h-5m1 10 2 2 4-4",
  professional: "M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v2",
};

export function PublicIcon({ name }: { name: keyof typeof strokes }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={strokes[name]} />
    </svg>
  );
}
