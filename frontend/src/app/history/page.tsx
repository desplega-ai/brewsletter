"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getStoredConfig,
  clearApiConfig,
  validateApiKey,
  getProcessingHistory,
  getScheduleHistory,
  type ProcessingHistoryItem,
} from "@/lib/api";

function HistoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scheduleId = searchParams.get("schedule");

  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [history, setHistory] = useState<ProcessingHistoryItem[]>([]);
  const [scheduleName, setScheduleName] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (isConnected) {
      loadHistory();
    }
  }, [isConnected, scheduleId]);

  // Auto-refresh every 10 seconds and on window focus
  useEffect(() => {
    if (!isConnected) return;

    const interval = setInterval(loadHistory, 10000);

    const handleFocus = () => loadHistory();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isConnected, scheduleId]);

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

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      if (scheduleId) {
        const result = await getScheduleHistory(parseInt(scheduleId), 50);
        setHistory(result.data);
        setScheduleName(result.schedule.name);
      } else {
        const result = await getProcessingHistory(50);
        setHistory(result.data);
        setScheduleName(null);
      }
    } catch (error) {
      console.error("Failed to load history:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearApiConfig();
    router.push("/");
  };

  const viewDetail = (id: number) => {
    router.push(`/history/${id}`);
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
        <div className="max-w-[1800px] mx-auto px-6 h-full flex flex-col">
          <div className="flex-shrink-0 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {scheduleName ? `${scheduleName} - History` : "Processing History"}
              </h1>
              <p className="text-muted-foreground">
                {scheduleName
                  ? "View all digests sent by this schedule"
                  : "View all sent digest summaries"}
              </p>
            </div>
            <div className="flex gap-2">
              {scheduleName && (
                <Button variant="outline" onClick={() => router.push("/history")}>
                  View All
                </Button>
              )}
              <Button variant="outline" onClick={() => router.push("/schedules")}>
                Back to Schedules
              </Button>
            </div>
          </div>

          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden mb-6">
            <CardHeader>
              <CardTitle>Sent Digests</CardTitle>
              <CardDescription>Click on a row to view the full email content</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No digests have been sent yet.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      {!scheduleName && <TableHead>Schedule</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Newsletters</TableHead>
                      <TableHead>Sent To</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((item) => (
                      <TableRow
                        key={item.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => viewDetail(item.id)}
                      >
                        <TableCell>
                          {new Date(item.triggeredAt).toLocaleString()}
                        </TableCell>
                        {!scheduleName && (
                          <TableCell>
                            {item.scheduleName ? (
                              <Badge variant="outline">{item.scheduleName}</Badge>
                            ) : (
                              <span className="text-muted-foreground">Manual</span>
                            )}
                          </TableCell>
                        )}
                        <TableCell>
                          <Badge
                            variant={
                              item.status === "completed"
                                ? "default"
                                : item.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                          >
                            {item.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.newsletterCount}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {item.sentToEmail || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default function HistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <HistoryContent />
    </Suspense>
  );
}
