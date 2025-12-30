"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { getPreferences, updatePreferences } from "@/lib/api";
import { toast } from "sonner";

const SUGGESTED_INTERESTS = [
  "AI", "Technology", "Startups", "Business", "Programming",
  "Science", "Finance", "Marketing", "Design", "Security",
  "Cloud", "Data", "DevOps", "Mobile", "Web Development"
];

export function PreferencesForm() {
  const [deliveryEmail, setDeliveryEmail] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [customInterest, setCustomInterest] = useState("");
  const [formatPreference, setFormatPreference] = useState("digest");
  const [summaryLength, setSummaryLength] = useState("medium");
  const [includeLinks, setIncludeLinks] = useState(true);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await getPreferences();
      if (prefs.exists) {
        setDeliveryEmail(prefs.deliveryEmail || "");
        setInterests(prefs.interests || []);
        setFormatPreference(prefs.formatPreference || "digest");
        setSummaryLength(prefs.summaryLength || "medium");
        setIncludeLinks(prefs.includeLinks !== false);
        setCustomPrompt(prefs.customPrompt || "");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load preferences");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!deliveryEmail) {
      toast.error("Delivery email is required");
      return;
    }

    setIsSaving(true);
    try {
      await updatePreferences({
        deliveryEmail,
        interests,
        formatPreference,
        summaryLength,
        includeLinks,
        customPrompt: customPrompt || undefined,
      });
      toast.success("Preferences saved!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const addCustomInterest = () => {
    if (customInterest && !interests.includes(customInterest)) {
      setInterests((prev) => [...prev, customInterest]);
      setCustomInterest("");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-muted-foreground">Loading preferences...</div>
      </div>
    );
  }

  return (
    <div className="max-w-[1800px] mx-auto px-6 h-full flex flex-col overflow-hidden">
      {/* Header with save button */}
      <div className="flex-shrink-0 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Preferences</h1>
          <p className="text-muted-foreground">
            Configure how your newsletter digest is generated and delivered
          </p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Spinner />}
          {isSaving ? "Saving..." : "Save Preferences"}
        </Button>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0 pb-6">
        {/* Left column */}
        <div className="space-y-6 overflow-auto">
          <Card>
            <CardHeader>
              <CardTitle>Delivery Settings</CardTitle>
              <CardDescription>Where should we send your newsletter digest?</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="deliveryEmail">Delivery Email</Label>
                <Input
                  id="deliveryEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={deliveryEmail}
                  onChange={(e) => setDeliveryEmail(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Summary Format</CardTitle>
              <CardDescription>How would you like your digest formatted?</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={formatPreference} onValueChange={setFormatPreference}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="digest">Digest (combined)</SelectItem>
                      <SelectItem value="individual">Individual summaries</SelectItem>
                      <SelectItem value="brief">Brief highlights only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Summary Length</Label>
                  <Select value={summaryLength} onValueChange={setSummaryLength}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="short">Short (1-2 sentences)</SelectItem>
                      <SelectItem value="medium">Medium (3-4 sentences)</SelectItem>
                      <SelectItem value="long">Long (full paragraph)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="includeLinks"
                  checked={includeLinks}
                  onChange={(e) => setIncludeLinks(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <Label htmlFor="includeLinks" className="font-normal">
                  Include original article links in the digest
                </Label>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Right column */}
        <Card className="flex flex-col min-h-0 overflow-hidden">
          <CardHeader className="flex-shrink-0">
            <CardTitle>Interests & Instructions</CardTitle>
            <CardDescription>
              Select topics you care about and customize how the AI summarizes your newsletters.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 overflow-auto">
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_INTERESTS.map((interest) => (
                <Badge
                  key={interest}
                  variant={interests.includes(interest) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleInterest(interest)}
                >
                  {interest}
                </Badge>
              ))}
            </div>

            {interests.filter((i) => !SUGGESTED_INTERESTS.includes(i)).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground w-full">Custom interests:</span>
                {interests
                  .filter((i) => !SUGGESTED_INTERESTS.includes(i))
                  .map((interest) => (
                    <Badge
                      key={interest}
                      variant="default"
                      className="cursor-pointer"
                      onClick={() => toggleInterest(interest)}
                    >
                      {interest} ×
                    </Badge>
                  ))}
              </div>
            )}

            <div className="flex gap-2">
              <Input
                placeholder="Add custom interest..."
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomInterest()}
              />
              <Button variant="outline" onClick={addCustomInterest}>
                Add
              </Button>
            </div>

            <div className="space-y-2 pt-4 border-t">
              <Label htmlFor="customPrompt">Custom Instructions</Label>
              <textarea
                id="customPrompt"
                placeholder="e.g., Focus on actionable insights, highlight trends, skip announcements..."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
              <p className="text-xs text-muted-foreground">
                Default instructions for AI summarization (used when creating new schedules)
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
