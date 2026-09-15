const fs = require('fs');

const code = `import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getVapiCallLogsFn } from "@/lib/server-actions";
import { detectCountryFromPhone, formatPhoneWithCountryCode } from "@/lib/country-helper";
import { Headphones, Play, RefreshCw, Search, PhoneCall, Calendar, Clock, Sparkles } from "lucide-react";

export function AllCallRecordingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [calls, setCalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (open) {
      fetchCalls();
    }
  }, [open]);

  async function fetchCalls() {
    setLoading(true);
    try {
      const res = await getVapiCallLogsFn({ data: { limit: 50 } });
      if (res?.success && Array.isArray(res.calls)) {
        setCalls(res.calls);
      }
    } catch (e) {
      console.error("Failed to load all recordings:", e);
    }
    setLoading(false);
  }

  const filteredCalls = calls.filter((c) => {
    const q = search.toLowerCase();
    if (!q) return true;
    const phone = (c?.customer?.number || "").toLowerCase();
    const summary = (c?.analysis?.summary || "").toLowerCase();
    const transcript = (c?.transcript || "").toLowerCase();
    return phone.includes(q) || summary.includes(q) || transcript.includes(q);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-6 rounded-2xl bg-surface-1 border-border">
        <DialogHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400">
                <Headphones className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">🎙️ Global Call Recordings & Transcripts</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Browse and listen to all AI voice calls across all leads.
                </DialogDescription>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={fetchCalls}
              disabled={loading}
              className="rounded-xl h-8 gap-1.5 text-xs font-semibold"
            >
              <RefreshCw className={\`size-3.5 \${loading ? "animate-spin" : ""}\`} />
              Refresh
            </Button>
          </div>
        </DialogHeader>

        <div className="pt-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search recordings by phone, keyword, or transcript..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 rounded-xl text-xs bg-surface-2/60"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3.5 pt-3 pr-1">
          {loading ? (
            <div className="py-16 text-center text-muted-foreground text-xs">
              <RefreshCw className="size-6 animate-spin mx-auto mb-2 text-violet-400 opacity-60" />
              Loading voice recordings from Vapi server...
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-xs">
              <Headphones className="size-8 mx-auto mb-2 opacity-30" />
              No call recordings found. Make an AI outbound call to generate recordings!
            </div>
          ) : (
            filteredCalls.map((c) => {
              const customerPhone = c?.customer?.number || "";
              const countryInfo = detectCountryFromPhone(customerPhone);
              const formattedPhone = formatPhoneWithCountryCode(customerPhone);
              const recordingUrl = c?.recordingUrl || c?.artifact?.recordingUrl;
              const dateStr = c?.createdAt
                ? new Date(c.createdAt).toLocaleString("en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "Recent Call";
              const durationSec = Math.round(c?.duration || (c?.endedAt && c?.startedAt ? (new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime()) / 1000 : 0));
              const summary = c?.analysis?.summary;
              const transcript = c?.transcript;

              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-border/60 bg-surface-2/50 p-4 space-y-3 shadow-sm hover:border-violet-500/30 transition-all"
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{countryInfo.flag}</span>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {formattedPhone}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-2 py-0.5 rounded-md border-violet-500/30 bg-violet-500/10 text-violet-300">
                        {countryInfo.name}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1 font-mono">
                        <Clock className="size-3 text-violet-400" />
                        {durationSec}s
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3 text-muted-foreground" />
                        {dateStr}
                      </span>
                    </div>
                  </div>

                  {recordingUrl ? (
                    <div className="rounded-lg bg-background/80 p-2 border border-border/40">
                      <audio controls className="w-full h-8" src={recordingUrl} preload="none">
                        Your browser does not support audio element.
                      </audio>
                    </div>
                  ) : (
                    <div className="text-[11px] text-muted-foreground/60 italic">
                      Audio recording is processing or unavailable.
                    </div>
                  )}

                  {summary && (
                    <div className="rounded-lg bg-surface-1/90 p-2.5 text-xs border border-border/40 space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-400">
                        <Sparkles className="size-3" /> AI Call Summary
                      </div>
                      <p className="text-muted-foreground text-[11px] leading-relaxed">{summary}</p>
                    </div>
                  )}

                  {transcript && (
                    <details className="text-xs text-muted-foreground cursor-pointer group">
                      <summary className="font-semibold text-foreground/80 hover:text-violet-400 text-[11px] transition-colors">
                        📜 View Full Transcript
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap font-sans text-[11px] leading-relaxed bg-background/60 p-2.5 rounded-lg border border-border/40 max-h-40 overflow-y-auto">
                        {transcript}
                      </pre>
                    </details>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
`;

fs.writeFileSync('src/components/crm/AllCallRecordingsDialog.tsx', code, 'utf8');
console.log('AllCallRecordingsDialog.tsx created successfully!');