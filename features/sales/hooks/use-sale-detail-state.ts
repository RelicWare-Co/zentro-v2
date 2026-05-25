import { useReducer } from "react";

interface SaleDetailState {
  isOpen: boolean;
  selectedSaleId: string | null;
}

type SaleDetailAction =
  | { type: "close" }
  | { type: "open"; saleId: string }
  | { type: "sync"; fallbackSaleId: string | null; saleIds: Set<string> };

function saleDetailReducer(
  state: SaleDetailState,
  action: SaleDetailAction
): SaleDetailState {
  switch (action.type) {
    case "close":
      return { ...state, isOpen: false };
    case "open":
      return { isOpen: true, selectedSaleId: action.saleId };
    case "sync": {
      if (!action.fallbackSaleId) {
        return { isOpen: false, selectedSaleId: null };
      }
      if (state.selectedSaleId && action.saleIds.has(state.selectedSaleId)) {
        return state;
      }
      return { ...state, selectedSaleId: action.fallbackSaleId };
    }
    default:
      return state;
  }
}

export function useSaleDetailState() {
  return useReducer(saleDetailReducer, {
    isOpen: false,
    selectedSaleId: null,
  });
}

export type { SaleDetailAction, SaleDetailState };
