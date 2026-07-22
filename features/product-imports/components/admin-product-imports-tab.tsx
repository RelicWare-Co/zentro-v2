import {
  Alert,
  Badge,
  Button,
  FileInput,
  Group,
  Loader,
  Pagination,
  Select,
  SimpleGrid,
  Stepper,
  Table,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  History,
  PackageCheck,
  RefreshCcw,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  AdminTabError,
  AdminTabLoading,
} from "@/features/admin/components/admin-page-states";
import { useAdminOrganizationsQuery } from "@/features/admin/hooks/use-admin-platform";
import { DashboardPanelShell } from "@/features/dashboard/components/dashboard-ui-primitives";
import {
  downloadProductImportTemplate,
  useCommitProductImportMutation,
  usePreviewProductImportMutation,
  useProductImportDetailQuery,
  useProductImportersQuery,
  useProductImportHistoryQuery,
} from "@/features/product-imports/hooks/use-product-imports";
import type {
  ProductImportBatchDetail,
  ProductImportBatchSummary,
} from "@/features/product-imports/product-imports.schema";
import { getErrorMessage } from "@/lib/utils";

const importDateFormatter = new Intl.DateTimeFormat("es-CO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function statusColor(status: ProductImportBatchSummary["status"]) {
  if (status === "completed") {
    return "green";
  }
  if (status === "ready") {
    return "blue";
  }
  if (status === "invalid") {
    return "yellow";
  }
  return "red";
}

function statusLabel(status: ProductImportBatchSummary["status"]) {
  const labels = {
    ready: "Lista",
    invalid: "Con errores",
    completed: "Completada",
    failed: "Fallida",
  } as const;
  return labels[status];
}

function rowStatusLabel(status: "imported" | "invalid" | "valid") {
  if (status === "imported") {
    return "Importada";
  }
  return status === "valid" ? "Válida" : "Error";
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-black/20 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-bold text-2xl text-white tabular-nums">{value}</p>
    </div>
  );
}

function ImportRowsTable({ detail }: { detail: ProductImportBatchDetail }) {
  if (detail.rows.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-400">
        Esta importación no contiene filas procesables.
      </p>
    );
  }

  return (
    <Table.ScrollContainer minWidth={760}>
      <Table striped withRowBorders>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Fila</Table.Th>
            <Table.Th>Producto</Table.Th>
            <Table.Th>SKU / código</Table.Th>
            <Table.Th>Estado</Table.Th>
            <Table.Th>Detalle</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {detail.rows.map((row) => (
            <Table.Tr key={row.id}>
              <Table.Td>{row.rowNumber}</Table.Td>
              <Table.Td>
                <p className="font-medium text-white">
                  {row.normalizedData?.name ??
                    String(row.sourceData.nombre ?? "Producto inválido")}
                </p>
                <p className="text-xs text-zinc-500">
                  {row.normalizedData?.categoryName ?? "Sin categoría"}
                </p>
              </Table.Td>
              <Table.Td className="text-sm text-zinc-400">
                {row.normalizedData?.sku ?? "—"}
                {row.normalizedData?.barcode
                  ? ` · ${row.normalizedData.barcode}`
                  : ""}
              </Table.Td>
              <Table.Td>
                <Badge
                  color={row.status === "invalid" ? "red" : "green"}
                  tt="none"
                  variant="light"
                >
                  {rowStatusLabel(row.status)}
                </Badge>
              </Table.Td>
              <Table.Td>
                {row.issues.length > 0 ? (
                  <ul className="max-w-md space-y-1 text-red-300 text-xs">
                    {row.issues.map((issue) => (
                      <li key={`${issue.code}-${issue.field}`}>
                        {issue.field ? `${issue.field}: ` : ""}
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-green-400 text-xs">Sin errores</span>
                )}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function ImportDetail({
  batchId,
  initialData,
  onNewImport,
}: {
  batchId: string;
  initialData?: ProductImportBatchDetail;
  onNewImport: () => void;
}) {
  const [rowPage, setRowPage] = useState(1);
  const detailQuery = useProductImportDetailQuery(
    batchId,
    rowPage,
    initialData
  );
  const commit = useCommitProductImportMutation();
  const detail = detailQuery.data;

  const handleCommit = async () => {
    try {
      const result = await commit.mutateAsync(batchId);
      notifications.show({
        color: result.batch.status === "completed" ? "green" : "yellow",
        message:
          result.batch.status === "completed"
            ? `${result.batch.createdProducts} productos importados correctamente.`
            : "La importación debe corregirse antes de confirmar.",
      });
      setRowPage(1);
    } catch (error) {
      notifications.show({
        color: "red",
        message: getErrorMessage(error, "No se pudo confirmar la importación."),
      });
    }
  };

  if (detailQuery.isError) {
    return (
      <AdminTabError
        error={detailQuery.error}
        fallbackMessage="No se pudo cargar el detalle de la importación."
        onRetry={() => {
          detailQuery.refetch().catch(() => undefined);
        }}
        title="Detalle no disponible"
      />
    );
  }
  if (detailQuery.isPending || !detail) {
    return (
      <div className="flex justify-center p-12">
        <Loader color="voltage.5" />
      </div>
    );
  }
  const { batch } = detail;
  const activeStep = batch.status === "completed" ? 2 : 1;

  return (
    <div className="space-y-6">
      <Stepper active={activeStep} allowNextStepsSelect={false}>
        <Stepper.Step
          description="Organización y archivo"
          label="Seleccionar"
        />
        <Stepper.Step description="Validaciones" label="Previsualizar" />
        <Stepper.Step description="Resultado final" label="Completar" />
      </Stepper>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Group gap="xs">
            <h3 className="font-semibold text-lg text-white">
              {batch.originalFilename}
            </h3>
            <Badge color={statusColor(batch.status)} tt="none" variant="light">
              {statusLabel(batch.status)}
            </Badge>
          </Group>
          <p className="mt-1 text-sm text-zinc-500">
            {batch.organizationName} · {batch.importerLabel} · Lote {batch.id}
          </p>
        </div>
        <Button
          leftSection={<RefreshCcw aria-hidden="true" className="size-4" />}
          onClick={onNewImport}
          variant="default"
        >
          Nueva importación
        </Button>
      </div>

      {batch.errorMessage ? (
        <Alert
          color="red"
          icon={<AlertCircle className="size-4" />}
          title="No se puede confirmar"
        >
          {batch.errorMessage}
        </Alert>
      ) : null}
      {batch.status === "completed" ? (
        <Alert
          color="green"
          icon={<CheckCircle2 className="size-4" />}
          title="Importación completada"
        >
          Se crearon {batch.createdProducts} productos y{" "}
          {batch.createdCategories} categorías.
        </Alert>
      ) : null}

      <SimpleGrid cols={{ base: 2, sm: 5 }}>
        <SummaryCard label="Filas" value={batch.totalRows} />
        <SummaryCard label="Válidas" value={batch.validRows} />
        <SummaryCard label="Con errores" value={batch.invalidRows} />
        <SummaryCard label="Categorías nuevas" value={batch.newCategories} />
        <SummaryCard
          label={
            batch.status === "completed" ? "Productos creados" : "Por crear"
          }
          value={
            batch.status === "completed"
              ? batch.createdProducts
              : batch.validRows
          }
        />
      </SimpleGrid>

      <ImportRowsTable detail={detail} />
      {detail.rowTotal > detail.rowPageSize ? (
        <Pagination
          aria-label="Páginas de filas de importación"
          onChange={setRowPage}
          total={Math.ceil(detail.rowTotal / detail.rowPageSize)}
          value={rowPage}
        />
      ) : null}

      {batch.status === "ready" ? (
        <div className="flex justify-end">
          <Button
            color="voltage.5"
            leftSection={<PackageCheck aria-hidden="true" className="size-4" />}
            loading={commit.isPending}
            onClick={() => {
              handleCommit().catch(() => undefined);
            }}
          >
            Confirmar importación
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function ImportWizard({
  onPreview,
}: {
  onPreview: (detail: ProductImportBatchDetail) => void;
}) {
  const organizationsQuery = useAdminOrganizationsQuery();
  const importersQuery = useProductImportersQuery();
  const preview = usePreviewProductImportMutation();
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [importerKey, setImporterKey] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const importers = importersQuery.data?.importers ?? [];
  const selectedImporter = importers.find((item) => item.key === importerKey);
  const organizationOptions = useMemo(
    () =>
      (organizationsQuery.data?.organizations ?? []).map((item) => ({
        value: item.id,
        label: `${item.name} (${item.slug})`,
      })),
    [organizationsQuery.data?.organizations]
  );

  useEffect(() => {
    if (!importerKey && importers[0]) {
      setImporterKey(importers[0].key);
    }
  }, [importerKey, importers]);

  if (organizationsQuery.isPending || importersQuery.isPending) {
    return <AdminTabLoading />;
  }
  if (organizationsQuery.isError || importersQuery.isError) {
    return (
      <AdminTabError
        error={organizationsQuery.error ?? importersQuery.error}
        fallbackMessage="No se pudo preparar el importador."
        title="No se pudo cargar la configuración"
      />
    );
  }
  const handlePreview = async () => {
    if (!(organizationId && importerKey && file)) {
      return;
    }
    try {
      const detail = await preview.mutateAsync({
        organizationId,
        importerKey,
        file,
      });
      onPreview(detail);
      notifications.show({
        color: detail.batch.status === "ready" ? "green" : "yellow",
        message:
          detail.batch.status === "ready"
            ? "Archivo validado. Revisa y confirma la importación."
            : "La previsualización encontró errores que debes corregir.",
      });
    } catch (error) {
      notifications.show({
        color: "red",
        message: getErrorMessage(error, "No se pudo procesar el archivo."),
      });
    }
  };

  return (
    <div className="space-y-6">
      <Stepper active={0} allowNextStepsSelect={false}>
        <Stepper.Step
          description="Organización y archivo"
          label="Seleccionar"
        />
        <Stepper.Step description="Validaciones" label="Previsualizar" />
        <Stepper.Step description="Resultado final" label="Completar" />
      </Stepper>
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Select
          data={organizationOptions}
          label="Organización de destino"
          onChange={setOrganizationId}
          placeholder="Busca una organización"
          searchable
          value={organizationId}
        />
        <Select
          data={importers.map((item) => ({
            value: item.key,
            label: item.label,
          }))}
          label="Formato de origen"
          onChange={setImporterKey}
          value={importerKey}
        />
      </SimpleGrid>
      <FileInput
        accept={selectedImporter?.acceptedExtensions.join(",")}
        clearable
        description="Máximo 5 MiB y 5.000 productos. No se permiten fórmulas."
        label="Archivo de productos"
        leftSection={<FileSpreadsheet aria-hidden="true" className="size-4" />}
        onChange={setFile}
        placeholder="Selecciona el archivo"
        value={file}
      />
      <Group justify="space-between">
        <Button
          disabled={!selectedImporter?.template}
          leftSection={<Download aria-hidden="true" className="size-4" />}
          onClick={() => {
            if (!importerKey) {
              return;
            }
            downloadProductImportTemplate(importerKey).catch((error) => {
              notifications.show({
                color: "red",
                message: getErrorMessage(
                  error,
                  "No se pudo descargar la plantilla."
                ),
              });
            });
          }}
          variant="default"
        >
          Descargar plantilla
        </Button>
        <Button
          disabled={!(organizationId && importerKey && file)}
          leftSection={<Upload aria-hidden="true" className="size-4" />}
          loading={preview.isPending}
          onClick={() => {
            handlePreview().catch(() => undefined);
          }}
        >
          Previsualizar
        </Button>
      </Group>
    </div>
  );
}

function ImportHistory({ onSelect }: { onSelect: (batchId: string) => void }) {
  const [page, setPage] = useState(1);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const organizations = useAdminOrganizationsQuery();
  const history = useProductImportHistoryQuery(organizationId, page);

  if (history.isPending) {
    return <AdminTabLoading />;
  }
  if (history.isError) {
    return (
      <AdminTabError
        error={history.error}
        fallbackMessage="No se pudo cargar el historial."
        title="Historial no disponible"
      />
    );
  }
  return (
    <div className="space-y-4">
      <Select
        clearable
        data={(organizations.data?.organizations ?? []).map((item) => ({
          value: item.id,
          label: item.name,
        }))}
        label="Filtrar historial por organización"
        onChange={(value) => {
          setOrganizationId(value);
          setPage(1);
        }}
        placeholder="Todas las organizaciones"
        searchable
        value={organizationId}
      />
      {history.data.batches.length === 0 ? (
        <p className="rounded-xl border border-zinc-800 p-6 text-center text-sm text-zinc-500">
          No hay importaciones para el filtro seleccionado.
        </p>
      ) : (
        <>
          <Table.ScrollContainer minWidth={760}>
            <Table withRowBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Fecha</Table.Th>
                  <Table.Th>Organización</Table.Th>
                  <Table.Th>Archivo</Table.Th>
                  <Table.Th>Actor</Table.Th>
                  <Table.Th>Estado</Table.Th>
                  <Table.Th>Resultado</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {history.data.batches.map((batch) => (
                  <Table.Tr key={batch.id}>
                    <Table.Td className="text-sm text-zinc-400">
                      {importDateFormatter.format(batch.createdAt)}
                    </Table.Td>
                    <Table.Td>{batch.organizationName}</Table.Td>
                    <Table.Td>{batch.originalFilename}</Table.Td>
                    <Table.Td className="text-sm text-zinc-400">
                      {batch.createdByEmail}
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        color={statusColor(batch.status)}
                        tt="none"
                        variant="light"
                      >
                        {statusLabel(batch.status)}
                      </Badge>
                    </Table.Td>
                    <Table.Td className="text-sm text-zinc-400">
                      {batch.status === "completed"
                        ? `${batch.createdProducts} productos`
                        : `${batch.invalidRows} errores`}
                    </Table.Td>
                    <Table.Td>
                      <Button
                        onClick={() => onSelect(batch.id)}
                        size="compact-sm"
                        variant="subtle"
                      >
                        Ver detalle
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
          {history.data.total > history.data.pageSize ? (
            <Pagination
              aria-label="Páginas del historial de importaciones"
              onChange={setPage}
              total={Math.ceil(history.data.total / history.data.pageSize)}
              value={page}
            />
          ) : null}
        </>
      )}
    </div>
  );
}

export function AdminProductImportsTab() {
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<ProductImportBatchDetail>();

  const openDetail = (batchId: string, detail?: ProductImportBatchDetail) => {
    setActiveBatchId(batchId);
    setInitialData(detail);
  };

  return (
    <div className="space-y-6">
      <DashboardPanelShell
        description="Convierte archivos externos al contrato estándar de Zentro y valida todo antes de escribir."
        headerAside={
          <Badge
            leftSection={
              <FileSpreadsheet aria-hidden="true" className="size-3" />
            }
            tt="none"
            variant="light"
          >
            Pipeline canónico v1
          </Badge>
        }
        title="Importar productos"
      >
        {activeBatchId ? (
          <ImportDetail
            batchId={activeBatchId}
            initialData={initialData}
            onNewImport={() => {
              setActiveBatchId(null);
              setInitialData(undefined);
            }}
          />
        ) : (
          <ImportWizard
            onPreview={(detail) => openDetail(detail.batch.id, detail)}
          />
        )}
      </DashboardPanelShell>

      <DashboardPanelShell
        description="Auditoría de archivos, validaciones y resultados por organización."
        headerAside={
          <History aria-hidden="true" className="size-5 text-zinc-500" />
        }
        title="Historial de importaciones"
      >
        <ImportHistory onSelect={(batchId) => openDetail(batchId)} />
      </DashboardPanelShell>
    </div>
  );
}
