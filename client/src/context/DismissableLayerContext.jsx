import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const DismissableLayerContext = createContext(null);

export function DismissableLayerProvider({ children }) {
  const [activeLayerId, setActiveLayerId] = useState(null);
  const activeLayerIdRef = useRef(activeLayerId);
  const layersRef = useRef(new Map());
  activeLayerIdRef.current = activeLayerId;

  const registerLayer = useCallback((id, triggerRef, panelRef) => {
    const registration = { triggerRef, panelRef };
    layersRef.current.set(id, registration);

    return () => {
      if (layersRef.current.get(id) === registration) layersRef.current.delete(id);
      setActiveLayerId((current) => current === id ? null : current);
    };
  }, []);

  useEffect(() => {
    function dismissActiveLayer() {
      const activeId = activeLayerIdRef.current;
      if (activeId) setActiveLayerId((current) => current === activeId ? null : current);
    }

    function handlePointerDown(event) {
      const activeId = activeLayerIdRef.current;
      if (!activeId) return;

      const layer = layersRef.current.get(activeId);
      const target = event.target;
      if (!layer || !(target instanceof Node)) {
        dismissActiveLayer();
        return;
      }

      if (layer.triggerRef.current?.contains(target) || layer.panelRef.current?.contains(target)) return;
      dismissActiveLayer();
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') dismissActiveLayer();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const value = { activeLayerId, setActiveLayerId, registerLayer };
  return <DismissableLayerContext.Provider value={value}>{children}</DismissableLayerContext.Provider>;
}

export function useDismissableLayer(id) {
  const context = useContext(DismissableLayerContext);
  if (!context) throw new Error('useDismissableLayer must be used inside DismissableLayerProvider');

  const { activeLayerId, setActiveLayerId, registerLayer } = context;
  const triggerRef = useRef(null);
  const panelRef = useRef(null);

  useEffect(() => registerLayer(id, triggerRef, panelRef), [id, registerLayer]);

  const toggle = useCallback(() => {
    setActiveLayerId((current) => current === id ? null : id);
  }, [id, setActiveLayerId]);

  const close = useCallback(() => {
    setActiveLayerId((current) => current === id ? null : current);
  }, [id, setActiveLayerId]);

  return { isOpen: activeLayerId === id, triggerRef, panelRef, toggle, close };
}
