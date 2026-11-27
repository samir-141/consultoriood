import ClinicaPanel from "./ClinicaPanel";

type ClinicaPageProps = Readonly<{
  searchParams: Promise<{
    paciente?: string | string[];
    modo?: string | string[];
    paso?: string | string[];
  }>;
}>;

export default async function ClinicaPage({ searchParams }: ClinicaPageProps) {
  const params = await searchParams;
  const paciente = Array.isArray(params.paciente) ? params.paciente[0] : params.paciente;
  const modo = Array.isArray(params.modo) ? params.modo[0] : params.modo;
  const paso = Array.isArray(params.paso) ? params.paso[0] : params.paso;

  return (
    <ClinicaPanel
      initialPatientId={paciente ?? ""}
      initialMode={modo === "view" ? "view" : "edit"}
      initialStep={paso ?? "anamnesis"}
    />
  );
}
