"use client";

import { useCallback, useEffect, useState } from "react";

const USERNAME_STORAGE_KEY = "kasku_username";

export function useUsername() {
  const [username, setUsernameState] = useState<string>("");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(USERNAME_STORAGE_KEY);
      if (saved && saved.trim()) {
        setUsernameState(saved.trim());
      }
    } catch {
      // Ignore storage access errors
    } finally {
      setIsLoaded(true);
    }
  }, []);

  const saveUsername = useCallback((nextName: string) => {
    const cleaned = nextName.trim();
    try {
      if (cleaned) {
        window.localStorage.setItem(USERNAME_STORAGE_KEY, cleaned);
      } else {
        window.localStorage.removeItem(USERNAME_STORAGE_KEY);
      }
    } catch {
      // Ignore storage write errors
    }
    setUsernameState(cleaned);
    return cleaned;
  }, []);

  const clearUsername = useCallback(() => {
    try {
      window.localStorage.removeItem(USERNAME_STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }
    setUsernameState("");
  }, []);

  return {
    username,
    hasUsername: username.trim().length > 0,
    isLoaded,
    saveUsername,
    clearUsername,
  };
}
