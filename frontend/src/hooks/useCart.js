import { useCallback, useEffect, useRef, useState } from 'react';

import { CART_STORAGE_KEY } from '../utils/constants';
import {
  addServerCartItem,
  clearServerCart,
  getProduct,
  getServerCart,
  getToken,
  removeServerCartItem,
  updateServerCartItem,
} from '../services/api';
import { toProduct } from '../services/mappers';

const USE_API = import.meta.env.VITE_USE_API === 'true';
const canSync = () => USE_API && !!getToken();

const getStoredCart = () => {
  try {
    const savedCart = localStorage.getItem(CART_STORAGE_KEY);
    return savedCart ? JSON.parse(savedCart) : [];
  } catch {
    return [];
  }
};

const productIdOf = (item) =>
  typeof item.productId === 'object' ? item.productId._id : item.productId;

export function useCart() {
  const [cartItems, setCartItems] = useState(getStoredCart);
  const itemsRef = useRef(cartItems);
  itemsRef.current = cartItems;

  const serverIds = useRef({}); // productId -> server cart item id
  const queue = useRef(Promise.resolve()); // keeps server calls in order

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  const rememberIds = (data) => {
    (data?.items || []).forEach((i) => {
      const pid = productIdOf(i);
      serverIds.current[pid] = i._id || i.id || pid;
    });
  };

  const sync = useCallback((fn) => {
    if (!canSync()) return;
    queue.current = queue.current
      .then(fn)
      .then(rememberIds)
      .catch((e) => console.error('Cart sync failed:', e.message));
  }, []);

  // On load (API mode): pull the server cart and show it.
  useEffect(() => {
    if (!canSync()) return;
    (async () => {
      try {
        const data = await getServerCart();
        rememberIds(data);
        const serverItems = data?.items || [];
        if (serverItems.length === 0) return; // keep local cart

        const local = itemsRef.current;
        const merged = await Promise.all(
          serverItems.map(async (si) => {
            const pid = productIdOf(si);
            const known = local.find((l) => String(l.id) === String(pid));
            const product = known || toProduct(await getProduct(pid));
            return { ...product, quantity: si.quantity };
          })
        );
        setCartItems(merged);
      } catch (e) {
        console.error('Could not load server cart:', e.message);
      }
    })();
  }, []);

  const serverId = (id) => serverIds.current[id] ?? id;

  const handleAddToCart = useCallback((product, quantityToAdd = 1) => {
    setCartItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.id === product.id);

      if (existingItem) {
        return prevItems.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + quantityToAdd }
            : item
        );
      }

      return [...prevItems, { ...product, quantity: quantityToAdd }];
    });
    sync(() => addServerCartItem(product.id, quantityToAdd));
  }, [sync]);

  const handleIncreaseQuantity = useCallback((productId) => {
    const current = itemsRef.current.find((i) => i.id === productId);
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.id === productId ? { ...item, quantity: item.quantity + 1 } : item
      )
    );
    if (current) {
      sync(() => updateServerCartItem(serverId(productId), current.quantity + 1));
    }
  }, [sync]);

  const handleDecreaseQuantity = useCallback((productId) => {
    const current = itemsRef.current.find((i) => i.id === productId);
    setCartItems((prevItems) =>
      prevItems
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
    if (!current) return;
    if (current.quantity - 1 > 0) {
      sync(() => updateServerCartItem(serverId(productId), current.quantity - 1));
    } else {
      sync(() => removeServerCartItem(serverId(productId)));
    }
  }, [sync]);

  const handleRemoveItem = useCallback((productId) => {
    setCartItems((prevItems) =>
      prevItems.filter((item) => item.id !== productId)
    );
    sync(() => removeServerCartItem(serverId(productId)));
  }, [sync]);

  const handleClearCart = useCallback(() => {
    setCartItems([]);
    sync(() => clearServerCart());
  }, [sync]);

  return {
    cartItems,
    handleAddToCart,
    handleIncreaseQuantity,
    handleDecreaseQuantity,
    handleRemoveItem,
    handleClearCart,
  };
}
