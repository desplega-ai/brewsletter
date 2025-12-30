"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { ConnectionSetup } from "@/components/connection-setup";
import { Dashboard } from "@/components/dashboard";
import { getStoredConfig, clearApiConfig, validateApiKey } from "@/lib/api";

export default function Home() {
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
        setIsConnected(false);
      }
    }
    setIsChecking(false);
  };

  const handleConnect = () => {
    setIsConnected(true);
  };

  const handleDisconnect = () => {
    clearApiConfig();
    setIsConnected(false);
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isConnected) {
    return <ConnectionSetup onConnect={handleConnect} />;
  }

  return (
    <div className="min-h-screen">
      <Header isConnected={isConnected} onDisconnect={handleDisconnect} />
      <main className="max-w-[1800px] mx-auto px-6 py-8">
        <Dashboard />
      </main>
    </div>
  );
}
