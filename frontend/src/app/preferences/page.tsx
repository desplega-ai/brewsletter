"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { PreferencesForm } from "@/components/preferences-form";
import { getStoredConfig, clearApiConfig, validateApiKey } from "@/lib/api";

export default function PreferencesPage() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const config = getStoredConfig();
    if (config.url && config.key) {
      try {
        await validateApiKey();
        setIsConnected(true);
      } catch {
        router.push("/");
      }
    } else {
      router.push("/");
    }
    setIsChecking(false);
  };

  const handleDisconnect = () => {
    clearApiConfig();
    router.push("/");
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header isConnected={isConnected} onDisconnect={handleDisconnect} />
      <main className="flex-1 overflow-hidden">
        <PreferencesForm />
      </main>
    </div>
  );
}
