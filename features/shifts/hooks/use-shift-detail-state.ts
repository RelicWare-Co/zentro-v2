import { useReducer } from "react";

interface ShiftDetailState {
  isOpen: boolean;
  selectedShiftId: string | null;
}

type ShiftDetailAction =
  | { type: "close" }
  | { type: "open"; shiftId: string }
  | { type: "sync"; fallbackShiftId: string | null; shiftIds: Set<string> };

function shiftDetailReducer(
  state: ShiftDetailState,
  action: ShiftDetailAction
): ShiftDetailState {
  switch (action.type) {
    case "close":
      return { ...state, isOpen: false };
    case "open":
      return { isOpen: true, selectedShiftId: action.shiftId };
    case "sync": {
      if (!action.fallbackShiftId) {
        return { isOpen: false, selectedShiftId: null };
      }
      if (state.selectedShiftId && action.shiftIds.has(state.selectedShiftId)) {
        return state;
      }
      return { ...state, selectedShiftId: action.fallbackShiftId };
    }
    default:
      return state;
  }
}

export function useShiftDetailState() {
  return useReducer(shiftDetailReducer, {
    isOpen: false,
    selectedShiftId: null,
  });
}

export type { ShiftDetailAction, ShiftDetailState };
