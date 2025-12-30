"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`animate-spin h-4 w-4 ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateApiKey, setApiConfig, validateApiKey } from "@/lib/api";
import { toast } from "sonner";

interface ConnectionSetupProps {
  onConnect: () => void;
}

export function ConnectionSetup({ onConnect }: ConnectionSetupProps) {
  const [apiUrl, setApiUrl] = useState(process.env.NEXT_PUBLIC_API_URL || "http://localhost:5101");
  const [apiKey, setApiKey] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"connect" | "generate">("connect");

  const handleConnect = async () => {
    if (!apiUrl || !apiKey) {
      toast.error("Please enter both API URL and API Key");
      return;
    }

    setIsLoading(true);
    try {
      setApiConfig(apiUrl, apiKey);
      await validateApiKey();
      toast.success("Connected successfully!");
      onConnect();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateKey = async () => {
    if (!apiUrl) {
      toast.error("Please enter API URL");
      return;
    }

    setIsLoading(true);
    try {
      const result = await generateApiKey(apiUrl, "Frontend");
      setApiKey(result.apiKey);
      setApiConfig(apiUrl, result.apiKey);
      toast.success("API key generated! Save it securely.");
      onConnect();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate API key");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connect to Brewsletter Backend</CardTitle>
          <CardDescription>
            {mode === "connect"
              ? "Enter your backend URL and API key to get started"
              : "Generate a new API key for first-time setup"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiUrl">Backend API URL</Label>
            <Input
              id="apiUrl"
              placeholder="http://localhost:5101"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
            />
          </div>

          {mode === "connect" && (
            <div className="space-y-2">
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder="yn_..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            {mode === "connect" ? (
              <>
                <Button onClick={handleConnect} disabled={isLoading}>
                  {isLoading && <Spinner />}
                  {isLoading ? "Connecting..." : "Connect"}
                </Button>
                <Button variant="link" onClick={() => setMode("generate")} className="text-sm">
                  First time? Generate API key
                </Button>
              </>
            ) : (
              <>
                <Button onClick={handleGenerateKey} disabled={isLoading}>
                  {isLoading && <Spinner />}
                  {isLoading ? "Generating..." : "Generate API Key"}
                </Button>
                <Button variant="link" onClick={() => setMode("connect")} className="text-sm">
                  Already have an API key? Connect
                </Button>
              </>
            )}
          </div>

          {apiKey && mode === "generate" && (
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm font-medium mb-1">Your API Key:</p>
              <code className="text-xs break-all">{apiKey}</code>
              <p className="text-xs text-muted-foreground mt-2">
                Save this key! It won&apos;t be shown again.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
