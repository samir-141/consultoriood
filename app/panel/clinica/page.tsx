import ClinicaPanel from "./ClinicaPanel";

type ClinicaPageProps = Readonly<{
  searchParams: Promise<{ paciente?: string | string[] }>;
}>;

export default async function ClinicaPage({ searchParams }: ClinicaPageProps) {
  const params = await searchParams;
  const paciente = Array.isArray(params.paciente) ? params.paciente[0] : params.paciente;

  return <ClinicaPanel initialPatientId={paciente ?? ""} />;
}
