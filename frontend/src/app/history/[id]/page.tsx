"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getStoredConfig,
  clearApiConfig,
  validateApiKey,
  getProcessingDetail,
  type ProcessingDetail,
} from "@/lib/api";

export default function ProcessingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<ProcessingDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    const loadDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getProcessingDetail(parseInt(id));
        setDetail(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load details");
      } finally {
        setIsLoading(false);
      }
    };
    if (isConnected && id) {
      loadDetail();
    }
  }, [isConnected, id]);

  const handleDisconnect = () => {
    clearApiConfig();
    router.push("/");
  };

  const goBack = () => {
    if (detail?.scheduleId) {
      router.push(`/history?schedule=${detail.scheduleId}`);
    } else {
      router.push("/history");
    }
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
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Digest Details</h1>
              <p className="text-muted-foreground">
                View the full content of this digest email
              </p>
            </div>
            <Button variant="outline" onClick={goBack}>
              Back to History
            </Button>
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Loading...
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="py-12 text-center text-destructive">
                {error}
              </CardContent>
            </Card>
          ) : detail ? (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CardTitle>
                        {detail.scheduleName || "Manual Digest"}
                      </CardTitle>
                      <Badge
                        variant={
                          detail.status === "completed"
                            ? "default"
                            : detail.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {detail.status}
                      </Badge>
                    </div>
                  </div>
                  <CardDescription>
                    Processed {detail.newsletterCount} newsletters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 text-sm">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">Triggered:</span>{" "}
                        <span className="text-muted-foreground">
                          {new Date(detail.triggeredAt).toLocaleString()}
                        </span>
                      </div>
                      {detail.completedAt && (
                        <div>
                          <span className="font-medium">Completed:</span>{" "}
                          <span className="text-muted-foreground">
                            {new Date(detail.completedAt).toLocaleString()}
                          </span>
                        </div>
                      )}
                    </div>
                    {detail.sentToEmail && (
                      <div>
                        <span className="font-medium">Sent to:</span>{" "}
                        <span className="text-muted-foreground">
                          {detail.sentToEmail}
                        </span>
                      </div>
                    )}
                    {detail.errorMessage && (
                      <div className="text-destructive">
                        <span className="font-medium">Error:</span>{" "}
                        {detail.errorMessage}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {detail.summaryHtml && (
                <Card>
                  <CardHeader>
                    <CardTitle>Email Content</CardTitle>
                    <CardDescription>
                      This is the digest that was sent via email
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <iframe
                        srcDoc={detail.summaryHtml}
                        className="w-full min-h-[600px] border-0"
                        title="Email Preview"
                        sandbox="allow-same-origin"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : null}
        </div>
      </main>
    </div>
  );
}
