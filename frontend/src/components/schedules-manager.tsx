"use client";

import { useState, useEffect, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  getSchedules,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getSchedulePresets,
  getScheduleDefaults,
  triggerSchedule,
  getProcessingStatus,
  type DigestSchedule,
  type SchedulePreset,
  type ScheduleDefaults,
} from "@/lib/api";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const SUGGESTED_TOPICS = [
  "AI", "Technology", "Startups", "Business", "Programming",
  "Science", "Finance", "Marketing", "Design", "Security",
  "Cloud", "Data", "DevOps", "Mobile", "Web Development"
];

export function SchedulesManager() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<DigestSchedule[]>([]);
  const [presets, setPresets] = useState<SchedulePreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<DigestSchedule | null>(null);
  const [triggeringId, setTriggeringId] = useState<number | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [topics, setTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [schedule, setSchedule] = useState("");
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [summaryLength, setSummaryLength] = useState("medium");
  const [includeLinks, setIncludeLinks] = useState(true);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  // Refresh on window focus
  useEffect(() => {
    const handleFocus = () => loadData();
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const loadData = async () => {
    try {
      const [schedulesRes, presetsRes] = await Promise.all([
        getSchedules(),
        getSchedulePresets(),
      ]);
      setSchedules(schedulesRes.data);
      setPresets(presetsRes.presets);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load schedules");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setTopics([]);
    setCustomTopic("");
    setSchedule("");
    setDeliveryEmail("");
    setSummaryLength("medium");
    setIncludeLinks(true);
    setCustomPrompt("");
    setEditingSchedule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (s: DigestSchedule) => {
    setEditingSchedule(s);
    setName(s.name);
    setTopics(s.topics);
    setSchedule(s.schedule);
    setDeliveryEmail(s.deliveryEmail);
    setSummaryLength(s.summaryLength);
    setIncludeLinks(s.includeLinks);
    setCustomPrompt(s.customPrompt || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name || topics.length === 0 || !schedule || !deliveryEmail) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsSaving(true);
    try {
      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, {
          name,
          topics,
          schedule,
          deliveryEmail,
          summaryLength,
          includeLinks,
          customPrompt: customPrompt || undefined,
        });
        toast.success("Schedule updated");
      } else {
        const result = await createSchedule({
          name,
          topics,
          schedule,
          deliveryEmail,
          summaryLength,
          includeLinks,
          customPrompt: customPrompt || undefined,
        });
        toast.success(`Schedule created. Next run: ${new Date(result.nextRunAt).toLocaleString()}`);
      }
      setDialogOpen(false);
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save schedule");
    } finally {
      setIsSaving(false);
    }
  };

  const loadDefaults = async () => {
    setIsLoadingDefaults(true);
    try {
      const defaults = await getScheduleDefaults();
      if (defaults.deliveryEmail) setDeliveryEmail(defaults.deliveryEmail);
      setSummaryLength(defaults.summaryLength);
      setIncludeLinks(defaults.includeLinks);
      if (defaults.interests.length > 0) {
        setTopics((prev) => [...new Set([...prev, ...defaults.interests])]);
      }
      if (defaults.customPrompt) setCustomPrompt(defaults.customPrompt);
      toast.success("Loaded defaults from preferences");
    } catch (error) {
      toast.error("Failed to load defaults");
    } finally {
      setIsLoadingDefaults(false);
    }
  };

  const handleToggleActive = async (s: DigestSchedule) => {
    try {
      await updateSchedule(s.id, { isActive: !s.isActive });
      toast.success(s.isActive ? "Schedule paused" : "Schedule activated");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update schedule");
    }
  };

  const handleDelete = async (s: DigestSchedule) => {
    if (!confirm(`Delete schedule "${s.name}"?`)) return;

    try {
      await deleteSchedule(s.id);
      toast.success("Schedule deleted");
      loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete schedule");
    }
  };

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const handleTrigger = async (s: DigestSchedule) => {
    setTriggeringId(s.id);
    try {
      const result = await triggerSchedule(s.id);
      const currentProcessingId = result.processingId;
      toast.success(`Processing ${result.newsletterCount} newsletters...`);

      // Clear any existing poll
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }

      // Poll for completion
      let pollCount = 0;
      const maxPolls = 60;

      pollIntervalRef.current = setInterval(async () => {
        pollCount++;
        try {
          const status = await getProcessingStatus();
          const isOurProcessingDone = !status.isProcessing &&
            status.lastProcessing?.id == currentProcessingId;
          const processingFinished = !status.isProcessing;

          if (isOurProcessingDone || pollCount >= maxPolls || processingFinished) {
            if (pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
              pollIntervalRef.current = null;
            }
            setTriggeringId(null);
            loadData();

            if (status.lastProcessing?.status === "completed") {
              toast.success("Digest sent to your email!");
            } else if (status.lastProcessing?.status === "failed") {
              toast.error(status.lastProcessing.errorMessage || "Processing failed");
            } else if (pollCount >= maxPolls) {
              toast.error("Processing timed out");
            }
          }
        } catch (err) {
          console.error("Poll error:", err);
        }
      }, 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to trigger schedule");
      setTriggeringId(null);
    }
  };

  const viewHistory = (s: DigestSchedule) => {
    router.push(`/history?schedule=${s.id}`);
  };

  const toggleTopic = (topic: string) => {
    setTopics((prev) =>
      prev.includes(topic)
        ? prev.filter((t) => t !== topic)
        : [...prev, topic]
    );
  };

  const addCustomTopic = () => {
    if (customTopic && !topics.includes(customTopic)) {
      setTopics((prev) => [...prev, customTopic]);
      setCustomTopic("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading schedules...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Digest Schedules</h1>
          <p className="text-muted-foreground">
            Create automated digests for different topics on different schedules
          </p>
        </div>
        <Button onClick={openCreateDialog}>Create Schedule</Button>
      </div>

      {schedules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No schedules yet. Create one to receive automated digests.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {schedules.map((s) => (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{s.name}</CardTitle>
                    <Badge variant={s.isActive ? "default" : "secondary"}>
                      {s.isActive ? "Active" : "Paused"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => handleTrigger(s)}
                      disabled={triggeringId === s.id}
                    >
                      {triggeringId === s.id && <Spinner />}
                      {triggeringId === s.id ? "Running..." : "Run Now"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => viewHistory(s)}>
                      History
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleActive(s)}>
                      {s.isActive ? "Pause" : "Activate"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(s)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(s)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <CardDescription>
                  {s.deliveryEmail} &bull; {presets.find(p => p.cron === s.schedule)?.description || s.schedule}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1 mb-3">
                  {s.topics.map((topic) => (
                    <Badge key={topic} variant="outline">
                      {topic}
                    </Badge>
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {s.lastRunAt && (
                    <span>Last run: {new Date(s.lastRunAt).toLocaleString()} &bull; </span>
                  )}
                  <span>Next run: {new Date(s.nextRunAt).toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>{editingSchedule ? "Edit Schedule" : "Create Schedule"}</DialogTitle>
                <DialogDescription>
                  Configure when and what topics to include in your digest
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={loadDefaults}
                disabled={isLoadingDefaults}
              >
                {isLoadingDefaults && <Spinner />}
                {isLoadingDefaults ? "Loading..." : "Use Defaults"}
              </Button>
            </div>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="e.g., AI Daily Digest"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Topics</Label>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_TOPICS.map((topic) => (
                  <Badge
                    key={topic}
                    variant={topics.includes(topic) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTopic(topic)}
                  >
                    {topic}
                  </Badge>
                ))}
              </div>
              {topics.filter((t) => !SUGGESTED_TOPICS.includes(t)).length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {topics
                    .filter((t) => !SUGGESTED_TOPICS.includes(t))
                    .map((topic) => (
                      <Badge
                        key={topic}
                        variant="default"
                        className="cursor-pointer"
                        onClick={() => toggleTopic(topic)}
                      >
                        {topic} &times;
                      </Badge>
                    ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  placeholder="Add custom topic..."
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomTopic()}
                />
                <Button variant="outline" onClick={addCustomTopic}>
                  Add
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Schedule</Label>
              <div className="flex gap-2">
                <Select value={schedule} onValueChange={setSchedule}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select a preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {presets.map((preset) => (
                      <SelectItem key={preset.cron} value={preset.cron}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-32"
                  placeholder="0 8 * * 1-5"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Select a preset or enter a custom cron expression
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Delivery Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={deliveryEmail}
                onChange={(e) => setDeliveryEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Summary Length</Label>
                <Select value={summaryLength} onValueChange={setSummaryLength}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="short">Short</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="long">Long</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <div className="flex items-center gap-2 h-10">
                  <input
                    type="checkbox"
                    id="includeLinks"
                    checked={includeLinks}
                    onChange={(e) => setIncludeLinks(e.target.checked)}
                    className="rounded"
                  />
                  <Label htmlFor="includeLinks" className="font-normal">
                    Include links
                  </Label>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="customPrompt">Custom Instructions (Optional)</Label>
              <textarea
                id="customPrompt"
                placeholder="e.g., Focus on actionable insights, highlight trends, skip announcements..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Add specific instructions to guide how the AI summarizes your newsletters
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Spinner />}
              {isSaving ? "Saving..." : editingSchedule ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
