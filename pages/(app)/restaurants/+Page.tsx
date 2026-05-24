import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { RestaurantFloorView } from "@/features/restaurants/components/restaurant-floor-view";
import { RestaurantServiceView } from "@/features/restaurants/components/restaurant-service-view";
import { useRestaurantPageState } from "@/features/restaurants/hooks/use-restaurant-page-state";

export default function RestaurantsPage() {
  const state = useRestaurantPageState();

  return (
    <main className="flex h-[calc(100dvh-4rem)] flex-col bg-[var(--color-void)] p-4 text-[var(--color-photon)] md:p-6">
      {state.isBootstrapError ? (
        <Alert
          className="mb-4 border-red-500/20 bg-red-500/10 text-red-100"
          variant="destructive"
        >
          <AlertTitle>Acceso denegado</AlertTitle>
          <AlertDescription>
            {state.bootstrapError instanceof Error
              ? state.bootstrapError.message
              : "No tienes acceso al módulo de restaurantes."}
          </AlertDescription>
        </Alert>
      ) : null}

      <header className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-semibold text-2xl tracking-tight">
            Restaurantes
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {state.isServiceMode
              ? "Modo servicio — carta y cuenta en una sola vista."
              : "Plano del salón con estado en tiempo real."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {state.bootstrap?.activeShift ? (
            <Badge
              className="border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
              variant="outline"
            >
              Caja abierta
            </Badge>
          ) : (
            <Badge
              className="border-amber-400/30 bg-amber-400/10 text-amber-100"
              variant="outline"
            >
              Sin caja activa
            </Badge>
          )}
        </div>
      </header>

      <div aria-live="polite" className="mb-4">
        {state.feedbackMessage ? (
          <Alert className="border-zinc-700 bg-[var(--color-carbon)] text-[var(--color-photon)]">
            <AlertTitle>Estado</AlertTitle>
            <AlertDescription>{state.feedbackMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {state.bootstrap && state.isServiceMode && state.selectedTable ? (
          <RestaurantServiceView
            activeCategoryId={state.activeCategoryId}
            addItemPending={state.mutations.addItemPending}
            bootstrap={state.bootstrap}
            closeOrderPending={state.mutations.closeOrderPending}
            deleteDraftPending={state.mutations.deleteDraftPending}
            guestCountInput={state.guestCountInput}
            onAddProduct={state.handleAddProduct}
            onBack={state.clearSelection}
            onCategoryChange={state.setActiveCategoryId}
            onCloseOrder={state.handleCloseOrder}
            onDeleteDraftItem={state.handleDeleteDraftItem}
            onGuestCountChange={state.setGuestCountInput}
            onMarkItemServed={state.handleMarkItemServed}
            onNotesChange={state.setOrderNotes}
            onPaymentMethodChange={state.setPaymentMethod}
            onPaymentReferenceChange={state.setPaymentReference}
            onSaveMeta={state.handleSaveOrderMeta}
            onSearchChange={state.setSearchQuery}
            onSendToKitchen={state.handleSendToKitchen}
            onUpdateDraftQuantity={state.handleUpdateDraftQuantity}
            openOrder={state.openOrder}
            orderNotes={state.orderNotes}
            paymentMethod={state.paymentMethod}
            paymentReference={state.paymentReference}
            products={state.products}
            requiresReference={state.requiresReference}
            searchQuery={state.searchQuery}
            selectedTable={state.selectedTable}
            sendToKitchenPending={state.mutations.sendToKitchenPending}
            updateDraftPending={state.mutations.updateDraftPending}
            updateOrderMetaPending={state.mutations.updateOrderMetaPending}
            updateStatusPending={state.mutations.updateStatusPending}
          />
        ) : null}
        {state.bootstrap && !state.isServiceMode ? (
          <RestaurantFloorView
            bootstrap={state.bootstrap}
            canManageLayout={state.canManageLayout}
            kitchenEnabled={
              state.bootstrap.settings.restaurant.kitchen.displayEnabled
            }
            onSelectTable={state.selectTable}
            selectedTableId={state.selectedTableId}
          />
        ) : null}
      </div>
    </main>
  );
}
