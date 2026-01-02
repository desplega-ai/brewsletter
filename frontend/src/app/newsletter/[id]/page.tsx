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
  getNewsletter,
  generateSummary,
  type Newsletter,
} from "@/lib/api";
import { toast } from "sonner";

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

export default function NewsletterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showHtml, setShowHtml] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  useEffect(() => {
    if (isConnected && id) {
      loadNewsletter();
    }
  }, [isConnected, id]);

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

  const loadNewsletter = async () => {
    try {
      const data = await getNewsletter(parseInt(id));
      setNewsletter(data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load newsletter");
      router.push("/");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    clearApiConfig();
    router.push("/");
  };

  const handleProcess = async () => {
    if (!newsletter) return;
    setIsProcessing(true);
    try {
      const result = await generateSummary([newsletter.id], false, newsletter.isProcessed);
      toast.success(`Processing started. Check your email shortly!`);
      // Reload to get updated processed status
      await loadNewsletter();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to process newsletter");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <Header isConnected={isConnected} onDisconnect={handleDisconnect} />
        <main className="max-w-[1800px] mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading newsletter...</div>
          </div>
        </main>
      </div>
    );
  }

  if (!newsletter) {
    return (
      <div className="min-h-screen">
        <Header isConnected={isConnected} onDisconnect={handleDisconnect} />
        <main className="max-w-[1800px] mx-auto px-6 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Newsletter not found</div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header isConnected={isConnected} onDisconnect={handleDisconnect} />
      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="max-w-[1800px] mx-auto w-full px-6 flex flex-col flex-1 overflow-hidden">
          {/* Header section - sticky */}
          <div className="flex-shrink-0 py-4 bg-background">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold">{newsletter.subject}</h1>
                <p className="text-muted-foreground">
                  From: {newsletter.fromName ? `${newsletter.fromName} <${newsletter.fromAddress}>` : newsletter.fromAddress}
                  {" "}&bull;{" "}
                  {new Date(newsletter.receivedAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  onClick={handleProcess}
                  disabled={isProcessing}
                >
                  {isProcessing && <Spinner />}
                  {isProcessing ? "Processing..." : newsletter.isProcessed ? "Reprocess" : "Process & Send"}
                </Button>
                <Button variant="outline" onClick={() => router.push("/")}>
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </div>

          {/* Two-column layout - fills remaining space */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 pb-6">
            {/* Left column: Extracted content */}
            <Card className="flex flex-col min-h-0 overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle>Extracted Content</CardTitle>
                  <Badge variant={newsletter.isProcessed ? "default" : "secondary"}>
                    {newsletter.isProcessed ? "Processed" : "Pending"}
                  </Badge>
                </div>
                <CardDescription>
                  {newsletter.extractedContent
                    ? "AI-extracted summary and key information"
                    : "Process this newsletter to extract content"}
                </CardDescription>
                {newsletter.topics && newsletter.topics.length > 0 && (
                  <div className="flex gap-1 flex-wrap pt-2">
                    {newsletter.topics.map((topic) => (
                      <Badge key={topic} variant="outline">
                        {topic}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent className="flex-1 overflow-auto">
                {newsletter.extractedContent ? (
                  <div className="space-y-6">
                    {newsletter.extractedContent.keyTakeaways && newsletter.extractedContent.keyTakeaways.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Key Takeaways</h3>
                        <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                          {newsletter.extractedContent.keyTakeaways.map((takeaway: string, i: number) => (
                            <li key={i}>{takeaway}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {newsletter.extractedContent.sections && newsletter.extractedContent.sections.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Sections</h3>
                        <div className="space-y-3">
                          {newsletter.extractedContent.sections.map((section: any, i: number) => (
                            <div key={i} className="border-l-2 border-muted pl-4">
                              <h4 className="font-medium text-sm">{section.heading}</h4>
                              <p className="text-sm text-muted-foreground">{section.summary}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {newsletter.extractedContent.links && newsletter.extractedContent.links.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium">Links</h3>
                        <ul className="space-y-1 text-sm">
                          {newsletter.extractedContent.links.map((link: any, i: number) => (
                            <li key={i}>
                              {link.url ? (
                                <a
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline"
                                >
                                  {link.title}
                                </a>
                              ) : (
                                <span className="text-muted-foreground">{link.title}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No extracted content yet.</p>
                    <p className="text-sm mt-2">Click &quot;Process & Send&quot; to extract content and generate a digest.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right column: Preview */}
            <Card className="flex flex-col min-h-0 overflow-hidden">
              <CardHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Email Preview</CardTitle>
                    <CardDescription>Original newsletter content</CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant={showHtml ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowHtml(true)}
                      disabled={!newsletter.rawHtml}
                    >
                      HTML
                    </Button>
                    <Button
                      variant={!showHtml ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowHtml(false)}
                    >
                      Text
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col min-h-0 p-0">
                {showHtml && newsletter.rawHtml ? (
                  <div className="flex-1 overflow-hidden">
                    <iframe
                      srcDoc={`
                        <html>
                          <head>
                            <link rel="preconnect" href="https://fonts.googleapis.com">
                            <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
                            <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet">
                            <style>
                              * { font-family: 'Geist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important; }
                              body { margin: 0; padding: 16px; }
                            </style>
                          </head>
                          <body>${newsletter.rawHtml}</body>
                        </html>
                      `}
                      className="w-full h-full border-0"
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                ) : (
                  <div className="bg-muted p-4 overflow-auto flex-1">
                    <pre className="text-sm whitespace-pre-wrap font-sans">
                      {newsletter.rawText || "No text content available"}
                    </pre>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
