import PagosPanel from "./PagosPanel";

type PagosPageProps = Readonly<{
  searchParams: Promise<{ paciente?: string | string[] }>;
}>;

export default async function PagosPage({ searchParams }: PagosPageProps) {
  const params = await searchParams;
  const paciente = Array.isArray(params.paciente) ? params.paciente[0] : params.paciente;

  return <PagosPanel initialPatientId={paciente ?? ""} />;
}
