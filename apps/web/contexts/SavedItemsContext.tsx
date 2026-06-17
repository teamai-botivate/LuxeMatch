'use client';

import { createContext, useContext, useState, useEffect, useCallback } from "react";

import { trackEvent } from "@/lib/analytics";

interface SavedItemsContextType {
  savedItems: Set<string>;
  toggleSave: (productId: string) => void;
  clearSaved: () => void;
  isSaved: (productId: string) => boolean;
}

const SavedItemsContext = createContext<SavedItemsContextType | null>(null);

function loadFromStorage(): Set<string> {
  try {
    const raw = sessionStorage.getItem("luxematch_saved");
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {}
  return new Set();
}

export function SavedItemsProvider({ children }: { children: React.ReactNode }) {
  const [savedItems, setSavedItems] = useState<Set<string>>(loadFromStorage);

  useEffect(() => {
    sessionStorage.setItem("luxematch_saved", JSON.stringify([...savedItems]));
  }, [savedItems]);

  const toggleSave = useCallback((productId: string) => {
    setSavedItems(prev => {
      const next = new Set(prev);
      const wasSaved = next.has(productId);
      if (wasSaved) next.delete(productId);
      else next.add(productId);
      // Fire-and-forget analytics outside the state value computation.
      trackEvent(wasSaved ? 'product_unsaved' : 'product_saved', { productId });
      return next;
    });
  }, []);

  const clearSaved = useCallback(() => setSavedItems(new Set()), []);
  const isSaved = useCallback((productId: string) => savedItems.has(productId), [savedItems]);

  return (
    <SavedItemsContext.Provider value={{ savedItems, toggleSave, clearSaved, isSaved }}>
      {children}
    </SavedItemsContext.Provider>
  );
}

export function useSavedItems(): SavedItemsContextType {
  const ctx = useContext(SavedItemsContext);
  if (!ctx) throw new Error("useSavedItems must be used within SavedItemsProvider");
  return ctx;
}
