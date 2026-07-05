import { Alert, Container, Stack } from "@mantine/core";
import { usePageContext } from "vike-react/usePageContext";
import { PublicCatalogMenu } from "@/features/public-catalog/components/public-catalog-menu";
import type { Data } from "./+data.server";

function CatalogPage({ data }: { data: Data }) {
  const { catalog, slug } = data;

  if (!slug) {
    return (
      <Container py="xl" size="sm">
        <Alert color="yellow" variant="light">
          Enlace inválido. Solicita el enlace correcto al negocio.
        </Alert>
      </Container>
    );
  }

  if (!catalog) {
    return (
      <Container py="xl" size="sm">
        <Stack align="center" gap="md">
          <Alert color="red" variant="light">
            No se pudo cargar el catálogo. Verifica que el enlace sea correcto.
          </Alert>
        </Stack>
      </Container>
    );
  }

  return (
    <PublicCatalogMenu
      organizationName={catalog.organizationName}
      products={catalog.products}
      slug={slug}
    />
  );
}

export default function PublicOrderPage() {
  const pageContext = usePageContext();
  const data = pageContext.data as Data;

  return (
    <div className="min-h-[100dvh] bg-[var(--color-void)] text-[var(--color-photon)]">
      <CatalogPage data={data} />
    </div>
  );
}
