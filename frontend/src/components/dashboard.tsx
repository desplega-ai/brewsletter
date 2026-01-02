"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getNewsletters,
  syncNewsletters,
  generateSummary,
  getProcessingStatus,
  type Newsletter,
  type ProcessingStatus,
} from "@/lib/api";
import { toast } from "sonner";

export function Dashboard() {
  const router = useRouter();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [syncingType, setSyncingType] = useState<"new" | "force" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus | null>(null);

  const loadNewsletters = useCallback(async (page = 1) => {
    try {
      const result = await getNewsletters(page);
      setNewsletters(result.data);
      setPagination({
        page: result.pagination.page,
        total: result.pagination.total,
        totalPages: result.pagination.totalPages,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load newsletters");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadProcessingStatus = useCallback(async () => {
    try {
      const status = await getProcessingStatus();
      setProcessingStatus(status);
    } catch (error) {
      console.error("Failed to load processing status:", error);
    }
  }, []);

  useEffect(() => {
    loadNewsletters();
    loadProcessingStatus();
  }, [loadNewsletters, loadProcessingStatus]);

  // Refresh data on window focus
  useEffect(() => {
    const handleFocus = () => {
      loadNewsletters();
      loadProcessingStatus();
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadNewsletters, loadProcessingStatus]);

  const handleSync = async (force = false) => {
    setSyncingType(force ? "force" : "new");
    try {
      const result = await syncNewsletters(force);
      toast.success(result.message);
      loadNewsletters();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to sync");
    } finally {
      setSyncingType(null);
    }
  };

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    const forceAll = unprocessedCount === 0; // Regenerate all if none unprocessed
    try {
      const result = await generateSummary(undefined, forceAll, forceAll);
      const currentProcessingId = result.processingId;
      toast.success(`Extracting topics from ${result.newsletterCount} newsletters...`);

      // Clear any existing poll
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      // Poll for completion with timeout
      let pollCount = 0;
      const maxPolls = 60; // 2 minutes max

      pollIntervalRef.current = setInterval(async () => {
        pollCount++;
        try {
          const status = await getProcessingStatus();
          setProcessingStatus(status);

          // Check if processing is done - use loose equality for ID comparison to handle type coercion
          const isOurProcessingDone = !status.isProcessing &&
            status.lastProcessing?.id == currentProcessingId;

          // Also stop if processing is no longer active (even if ID doesn't match)
          const processingFinished = !status.isProcessing;

          if (isOurProcessingDone || pollCount >= maxPolls || processingFinished) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setIsGenerating(false);
            loadNewsletters();

            // Show appropriate toast based on status
            if (status.lastProcessing?.id == currentProcessingId) {
              if (status.lastProcessing?.status === "completed") {
                toast.success("Newsletters processed! Topics extracted.");
              } else if (status.lastProcessing?.status === "failed") {
                toast.error(status.lastProcessing.errorMessage || "Processing failed");
              }
            } else if (pollCount >= maxPolls) {
              toast.error("Processing timed out");
            } else if (processingFinished && status.lastProcessing) {
              // Processing finished but ID doesn't match - still show result
              if (status.lastProcessing.status === "completed") {
                toast.success("Newsletters processed! Topics extracted.");
              } else if (status.lastProcessing.status === "failed") {
                toast.error(status.lastProcessing.errorMessage || "Processing failed");
              }
            }
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate summary");
      setIsGenerating(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleViewNewsletter = (id: number) => {
    router.push(`/newsletter/${id}`);
  };

  const unprocessedCount = newsletters.filter((n) => !n.isProcessed).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Newsletter Dashboard</h1>
          <p className="text-muted-foreground">
            {pagination.total} newsletters total, {unprocessedCount} unprocessed
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => handleSync(false)} disabled={syncingType !== null}>
            {syncingType === "new" && <Spinner />}
            {syncingType === "new" ? "Syncing..." : "Sync New"}
          </Button>
          <Button variant="outline" onClick={() => handleSync(true)} disabled={syncingType !== null}>
            {syncingType === "force" && <Spinner />}
            {syncingType === "force" ? "Refreshing..." : "Force Refresh All"}
          </Button>
          <Button
            onClick={handleGenerateSummary}
            disabled={isGenerating || newsletters.length === 0}
          >
            {isGenerating && <Spinner />}
            {isGenerating ? "Processing..." : unprocessedCount > 0 ? "Process Newsletters" : "Reprocess All"}
          </Button>
        </div>
      </div>

      {processingStatus?.lastProcessing && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Last Processing</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/history/${processingStatus.lastProcessing!.id}`)}
              >
                View
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex items-center gap-4 text-sm">
            <Badge variant={processingStatus.lastProcessing.status === "completed" ? "default" : "destructive"}>
              {processingStatus.lastProcessing.status}
            </Badge>
            <span>{processingStatus.lastProcessing.newsletterCount} newsletters</span>
            {processingStatus.lastProcessing.sentToEmail && (
              <span className="text-muted-foreground">
                Sent to: {processingStatus.lastProcessing.sentToEmail}
              </span>
            )}
            <span className="text-muted-foreground">
              {new Date(processingStatus.lastProcessing.triggeredAt).toLocaleString()}
            </span>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Newsletters</CardTitle>
          <CardDescription>Click on a newsletter to view details</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : newsletters.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No newsletters yet. Click &quot;Sync Emails&quot; to fetch from your inbox.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>From</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Topics</TableHead>
                    <TableHead>Received</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {newsletters.map((newsletter) => (
                    <TableRow
                      key={newsletter.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleViewNewsletter(newsletter.id)}
                    >
                      <TableCell className="font-medium">
                        {newsletter.fromName || newsletter.fromAddress}
                      </TableCell>
                      <TableCell className="max-w-md truncate">{newsletter.subject}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {newsletter.topics.slice(0, 3).map((topic) => (
                            <Badge key={topic} variant="secondary" className="text-xs">
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(newsletter.receivedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Badge variant={newsletter.isProcessed ? "outline" : "default"}>
                          {newsletter.isProcessed ? "Processed" : "Pending"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadNewsletters(pagination.page - 1)}
                    disabled={pagination.page === 1}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadNewsletters(pagination.page + 1)}
                    disabled={pagination.page === pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
