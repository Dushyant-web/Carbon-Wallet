"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

/*
 * Registers the service worker (offline page + reminder notifications) and keeps the browser's "install this
 * app" prompt for later: we ask only once the household has something worth coming back to (flaws.md D3).
 */

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Pwa = {
  registration: ServiceWorkerRegistration | null;
  canInstall: boolean; // Chrome/Edge/Android: we hold the browser's install prompt
  isIOS: boolean; // iPhone/iPad: install is "Share → Add to Home Screen", and push needs the installed app
  installed: boolean; // already running as the installed app
  install: () => Promise<boolean>;
};

const Ctx = createContext<Pwa>({ registration: null, canInstall: false, isIOS: false, installed: false, install: async () => false });
export const usePwa = () => useContext(Ctx);

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(setRegistration).catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPrompt(null);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (!prompt) return false;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    setPrompt(null);
    return outcome === "accepted";
  };

  return <Ctx.Provider value={{ registration, canInstall: !!prompt, isIOS, installed, install }}>{children}</Ctx.Provider>;
}
