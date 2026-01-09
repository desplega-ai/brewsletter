"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { SchedulesManager } from "@/components/schedules-manager";
import { getStoredConfig, clearApiConfig, validateApiKey } from "@/lib/api";

export default function SchedulesPage() {
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
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
    checkConnection();
  }, [router]);

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
    <div className="min-h-screen">
      <Header isConnected={isConnected} onDisconnect={handleDisconnect} />
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        <SchedulesManager />
      </main>
    </div>
  );
}
