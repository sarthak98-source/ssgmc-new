import { useState, useCallback } from "react";

export function useARTryOn() {
  const [open, setOpen] = useState(false);
  const [product, setProduct] = useState(null);

  const openAR = useCallback((p) => {
    setProduct(p);
    setOpen(true);
  }, []);

  const closeAR = useCallback(() => {
    setOpen(false);
    setTimeout(() => setProduct(null), 350);
  }, []);

  return { arOpen: open, arProduct: product, openAR, closeAR };
}
