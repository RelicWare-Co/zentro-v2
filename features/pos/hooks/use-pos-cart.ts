import { useCallback, useMemo, useState } from "react";
import { parseMoneyInput } from "@/lib/utils";
import type { CartItem, CartItemModifier, Product } from "../types";
import {
  buildModifierFingerprint,
  calculateCartTotals,
  calculateItemBaseAmount,
} from "../utils";

export function usePosCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountInput, setDiscountInput] = useState("0");

  const addToCart = useCallback(
    (product: Product, modifiers: CartItemModifier[]) => {
      setCart((prevCart) => {
        const targetModifierFingerprint = buildModifierFingerprint(modifiers);
        const existingItem = prevCart.find(
          (item) =>
            item.product.id === product.id &&
            buildModifierFingerprint(item.modifiers) ===
              targetModifierFingerprint
        );

        if (existingItem) {
          return prevCart.map((item) =>
            item.id === existingItem.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          );
        }

        return [
          ...prevCart,
          {
            id: crypto.randomUUID(),
            product,
            quantity: 1,
            modifiers,
            discountAmount: 0,
          },
        ];
      });
    },
    []
  );

  const removeFromCart = useCallback((cartItemId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== cartItemId));
  }, []);

  const updateQuantity = useCallback((cartItemId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart.reduce<typeof prevCart>((acc, item) => {
        if (item.id === cartItemId) {
          const newQuantity = item.quantity + delta;
          if (newQuantity > 0) {
            acc.push({ ...item, quantity: newQuantity });
          }
        } else if (item.quantity > 0) {
          acc.push(item);
        }
        return acc;
      }, [])
    );
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setDiscountInput("0");
  }, []);

  const resetDiscount = useCallback(() => {
    setDiscountInput("0");
  }, []);

  const updateItemDiscount = useCallback(
    (cartItemId: string, nextDiscountValue: string) => {
      const parsedDiscount = parseMoneyInput(nextDiscountValue);

      setCart((prevCart) =>
        prevCart.map((item) => {
          if (item.id !== cartItemId) {
            return item;
          }

          const lineBaseAmount = calculateItemBaseAmount(item);

          return {
            ...item,
            discountAmount: Math.min(parsedDiscount, lineBaseAmount),
          };
        })
      );
    },
    []
  );

  const getProductQuantity = useCallback(
    (productId: string) =>
      cart
        .filter((item) => item.product.id === productId)
        .reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const totals = useMemo(
    () => calculateCartTotals(cart, discountInput),
    [cart, discountInput]
  );

  const totalItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  return {
    cart,
    discountInput,
    setDiscountInput,
    addToCart,
    removeFromCart,
    updateQuantity,
    clearCart,
    resetDiscount,
    updateItemDiscount,
    getProductQuantity,
    totals,
    totalItems,
  };
}
