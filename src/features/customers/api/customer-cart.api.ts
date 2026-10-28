import { apiClient } from "@/lib/api/api-client";
import type {
  CartResponse,
  CartItemResponse,
  CartCountResponse,
} from "@/features/cart/types/cart.types";

const EMPTY_CART: CartResponse = {
  id: null,
  items: [],
  subtotal: 0,
  totalDiscount: 0,
  totalSavings: 0,
  total: 0,
  totalItems: 0,
};

export interface AddCartItemPayload {
  variantId: string;
  quantity: number;
}

export const customerCartApi = {
  /**
   * Fetch customer cart
   * Postman: GET /api/customer/cart
   */
  async getCart(): Promise<CartResponse> {
    const response = await apiClient.get<CartResponse>("/api/customer/cart");
    return response.data ?? EMPTY_CART;
  },

  /**
   * Fetch customer cart count
   * Postman: GET /api/customer/cart/count
   */
  async getCartCount(): Promise<CartCountResponse> {
    try {
      const cart = await this.getCart();
      const totalQuantity = (cart.items || []).reduce(
        (sum, item) => sum + (item.quantity || 0),
        0
      );
      return {
        count: cart.totalItems ?? cart.items?.length ?? 0,
        totalQuantity: totalQuantity || cart.totalItems || 0,
      };
    } catch {
      return { count: 0, totalQuantity: 0 };
    }
  },

  /**
   * Add variant to cart
   * Postman: POST /api/customer/cart/items
   */
  async addItem(payload: AddCartItemPayload): Promise<CartItemResponse> {
    const response = await apiClient.post<CartItemResponse>(
      "/api/customer/cart/items",
      payload
    );
    return response.data!;
  },

  /**
   * Update cart item quantity
   * Postman: PUT /api/customer/cart/items/:variantUuid
   */
  async updateQuantity(
    variantUuid: string,
    quantity: number
  ): Promise<CartItemResponse> {
    const response = await apiClient.put<CartItemResponse>(
      `/api/customer/cart/items/${variantUuid}`,
      { quantity }
    );
    return response.data!;
  },

  /**
   * Remove item from cart
   * Postman: DELETE /api/customer/cart/items/:variantUuid
   */
  async removeItem(variantUuid: string): Promise<void> {
    await apiClient.delete(`/api/customer/cart/items/${variantUuid}`);
  },

  /**
   * Clear entire cart
   * Postman: DELETE /api/customer/cart
   */
  async clearCart(): Promise<void> {
    await apiClient.delete("/api/customer/cart");
  },
};
