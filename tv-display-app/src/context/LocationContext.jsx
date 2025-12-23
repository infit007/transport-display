import React, { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";

export const LocationContext = createContext({
  position: null, // { lat, lng, accuracy, ts }
  permission: null, // 'granted' | 'denied' | 'prompt' | null
  error: null,
  isWatching: false,
  restart: () => {},
});

export const LocationProvider = ({ children }) => {
  const [position, setPosition] = useState(null);
  const [permission, setPermission] = useState(null);
  const [error, setError] = useState(null);
  const [isWatching, setIsWatching] = useState(false);
  const watchIdRef = useRef(null);

  // Check permission where supported
  useEffect(() => {
    let cancelled = false;
    if (navigator?.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((res) => {
          if (cancelled) return;
          setPermission(res.state || null);
          console.log("[Location] permission:", res.state);
          try {
            res.onchange = () => {
              setPermission(res.state || null);
              console.log("[Location] permission changed:", res.state);
            };
          } catch {}
        })
        .catch((e) => {
          console.warn("[Location] permission query failed", e);
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const startWatch = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError(new Error("Geolocation not supported"));
      console.error("[Location] Geolocation not supported by this browser");
      return;
    }
    try {
      if (watchIdRef.current != null) {
        try { navigator.geolocation.clearWatch(watchIdRef.current); } catch {}
        watchIdRef.current = null;
      }
      setIsWatching(true);
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          setError(null);
          const { latitude, longitude, accuracy } = pos.coords || {};
          const ts = pos.timestamp || Date.now();
          if (
            typeof latitude === "number" &&
            typeof longitude === "number" &&
            Number.isFinite(latitude) &&
            Number.isFinite(longitude)
          ) {
            const p = { lat: latitude, lng: longitude, accuracy, ts };
            setPosition(p);
            console.log("[Location] update:", p);
          } else {
            console.warn("[Location] invalid coords from watchPosition", pos);
          }
        },
        (err) => {
          setError(err);
          console.error("[Location] watchPosition error", err);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
      watchIdRef.current = id;
      console.log("[Location] started watch:", id);
    } catch (e) {
      setError(e);
      console.error("[Location] failed to start watch", e);
    }
  }, []);

  const stopWatch = useCallback(() => {
    try {
      if (watchIdRef.current != null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        console.log("[Location] stopped watch:", watchIdRef.current);
      }
    } catch (e) {
      console.warn("[Location] clearWatch failed", e);
    } finally {
      watchIdRef.current = null;
      setIsWatching(false);
    }
  }, []);

  const restart = useCallback(() => {
    stopWatch();
    startWatch();
  }, [startWatch, stopWatch]);

  useEffect(() => {
    startWatch();
    return () => stopWatch();
  }, [startWatch, stopWatch]);

  const value = useMemo(
    () => ({ position, permission, error, isWatching, restart }),
    [position, permission, error, isWatching, restart]
  );

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};

export const useLocation = () => React.useContext(LocationContext);
