"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getStoredConfig } from "@/lib/api";
import { toast } from "sonner";

interface HeaderProps {
  isConnected: boolean;
  onDisconnect: () => void;
}

export function Header({ isConnected, onDisconnect }: HeaderProps) {
  const pathname = usePathname();
  const [showApiKey, setShowApiKey] = useState(false);
  const config = getStoredConfig();

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(config.key);
    toast.success("API key copied to clipboard");
  };

  return (
    <>
      <header className="border-b bg-card">
        <div className="max-w-[1800px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold flex items-center gap-2">
              <Coffee className="h-6 w-6" />
              Brewsletter
            </Link>
            {isConnected && (
              <nav className="flex items-center gap-4">
                <Link
                  href="/"
                  className={`text-sm ${
                    pathname === "/" || pathname?.startsWith("/newsletter") ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/schedules"
                  className={`text-sm ${
                    pathname === "/schedules" ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Schedules
                </Link>
                <Link
                  href="/history"
                  className={`text-sm ${
                    pathname?.startsWith("/history") ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  History
                </Link>
                <Link
                  href="/preferences"
                  className={`text-sm ${
                    pathname === "/preferences" ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Preferences
                </Link>
              </nav>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                <Badge
                  variant="outline"
                  className="bg-amber-50 text-amber-700 border-amber-200 cursor-pointer hover:bg-amber-100"
                  onClick={() => setShowApiKey(true)}
                >
                  Connected
                </Badge>
                <Button variant="ghost" size="sm" onClick={onDisconnect}>
                  Disconnect
                </Button>
              </>
            ) : (
              <Badge variant="outline" className="bg-stone-100 text-stone-600 border-stone-200">
                Not Connected
              </Badge>
            )}
          </div>
        </div>
      </header>

      <Dialog open={showApiKey} onOpenChange={setShowApiKey}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connection Details</DialogTitle>
            <DialogDescription>
              Your API connection information
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Backend URL</label>
              <div className="bg-muted p-2 rounded text-sm font-mono break-all">
                {config.url}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <div className="bg-muted p-2 rounded text-sm font-mono break-all">
                {config.key}
              </div>
            </div>
            <Button onClick={handleCopyApiKey} className="w-full">
              Copy API Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
