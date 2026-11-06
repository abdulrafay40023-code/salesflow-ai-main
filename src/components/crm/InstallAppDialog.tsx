import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Smartphone, Monitor, Share, PlusSquare, MoreVertical, Download, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { isMobileDevice, isIOSDevice } from "@/lib/install-helper";

interface InstallAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deferredPrompt: any;
  onInstalled: () => void;
}

export function InstallAppDialog({ open, onOpenChange, deferredPrompt, onInstalled }: InstallAppDialogProps) {
  const [tab, setTab] = useState<"desktop" | "mobile">("mobile");
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (open) {
      setTab(isMobileDevice() ? "mobile" : "desktop");
      setIos(isIOSDevice());
    }
  }, [open]);

  const activePrompt =
    deferredPrompt || (typeof window !== "undefined" ? (window as any).__tealsDeferredPrompt : null);

  const handleNativeInstall = async () => {
    if (!activePrompt) return;
    try {
      await activePrompt.prompt();
      const choiceResult = await activePrompt.userChoice;
      (window as any).__tealsDeferredPrompt = null;
      if (choiceResult.outcome === "accepted") {
        onInstalled();
        onOpenChange(false);
        toast.success("Teals CRM App installed successfully!");
      }
    } catch {}
  };

  const handleDownloadMobileProfile = () => {
    try {
      const a = document.createElement("a");
      a.href = "/Teals-CRM.mobileconfig";
      a.download = "Teals-CRM.mobileconfig";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Mobile App Profile downloaded!", {
        description: "Open Settings > Profile Downloaded > Install to add Teals CRM to your Home Screen.",
      });
    } catch {
      toast.error("Could not download mobile profile.");
    }
  };

  const handleDownloadDesktopShortcut = () => {
    try {
      const origin =
        typeof window !== "undefined" ? window.location.origin : "https://salesflow-ai-main.vercel.app";
      const appUrl = `${origin}/dashboard`;
      const iconUrl = `${origin}/favicon.ico`;

      const batContent = [
        `@echo off`,
        `title Installing Teals CRM Desktop App...`,
        `set "APP_DIR=%LOCALAPPDATA%\\TealsCRM"`,
        `if not exist "%APP_DIR%" mkdir "%APP_DIR%"`,
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -Uri '${iconUrl}' -OutFile '%APP_DIR%\\teals.ico' -UseBasicParsing } catch {}"`,
        `powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws = New-Object -ComObject WScript.Shell; $desk = [Environment]::GetFolderPath('Desktop'); $s = $ws.CreateShortcut($desk + '\\Teals CRM.lnk'); $edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'; $chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'; if (Test-Path $chrome) { $s.TargetPath = $chrome; $s.Arguments = '--app=${appUrl}' } elseif (Test-Path $edge) { $s.TargetPath = $edge; $s.Arguments = '--app=${appUrl}' } else { $s.TargetPath = '${appUrl}' }; if (Test-Path '%APP_DIR%\\teals.ico') { $s.IconLocation = '%APP_DIR%\\teals.ico,0' }; $s.Save()"`,
        `start chrome.exe --app="${appUrl}" --window-size=1440,900 2>nul || start msedge.exe --app="${appUrl}" --window-size=1440,900 2>nul || start "" "${appUrl}"`,
        `exit`,
      ].join("\r\n");

      const blobBat = new Blob([batContent], { type: "application/x-bat" });
      const urlBat = URL.createObjectURL(blobBat);
      const aBat = document.createElement("a");
      aBat.href = urlBat;
      aBat.download = "Teals CRM Desktop Installer.bat";
      document.body.appendChild(aBat);
      aBat.click();
      document.body.removeChild(aBat);
      URL.revokeObjectURL(urlBat);

      toast.success("Teals CRM Desktop Installer downloaded!", {
        description: "Open the downloaded file once — it automatically places the Teals CRM icon on your Desktop and opens the app!",
      });
      onOpenChange(false);
    } catch {
      toast.error("Could not generate desktop launcher.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[94vw] max-w-md rounded-2xl p-5 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-3.5 mb-1">
            <img
              src="/icon-192.png?v=3"
              alt="Teals CRM Logo"
              className="size-12 rounded-2xl object-cover shadow-md border border-border"
            />
            <div className="text-left">
              <DialogTitle className="text-base sm:text-lg font-bold">
                Download Teals CRM App
              </DialogTitle>
              <DialogDescription className="text-xs">
                Install Teals CRM with the official shield icon on your phone or computer.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {activePrompt && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-4 shrink-0" />
              One-Click App Installation Ready
            </div>
            <p className="text-xs text-muted-foreground">
              Install Teals CRM directly onto your device with its official app icon and full-screen view.
            </p>
            <Button onClick={handleNativeInstall} className="w-full gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
              <Download className="size-4" />
              Install Teals CRM App Now
            </Button>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
          <button
            type="button"
            onClick={() => setTab("mobile")}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
              tab === "mobile"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="size-3.5" />
            Mobile Phone
          </button>
          <button
            type="button"
            onClick={() => setTab("desktop")}
            className={`flex items-center justify-center gap-2 rounded-md py-2 text-xs font-semibold transition-all ${
              tab === "desktop"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="size-3.5" />
            PC / Laptop
          </button>
        </div>

        {tab === "mobile" ? (
          <div className="space-y-3 pt-1">
            {/* App Icon Preview Card */}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
              <img
                src="/icon-192.png?v=3"
                alt="Teals App Icon"
                className="size-11 rounded-xl object-cover shadow-sm shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-foreground">Teals CRM Mobile App</p>
                <p className="text-[11px] text-muted-foreground">
                  Full-screen app experience with instant LiveChat & Project Management
                </p>
              </div>
            </div>

            {!ios ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 space-y-2.5">
                <p className="text-xs font-bold text-foreground flex items-center gap-2">
                  <span className="size-2 rounded-full bg-emerald-500" />
                  Android Phone — Install in 2 Seconds
                </p>
                <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
                  <li>
                    Tap the browser menu{" "}
                    <MoreVertical className="inline size-3.5 text-foreground mx-0.5" /> at the top-right of Chrome.
                  </li>
                  <li>
                    Tap{" "}
                    <strong className="text-foreground">"Install app"</strong> or{" "}
                    <strong className="text-foreground">"Add to Home screen"</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-emerald-600 dark:text-emerald-400">Install</strong> — the Teals CRM app with the <strong className="text-foreground">T</strong> logo will appear in your apps!
                  </li>
                </ol>
              </div>
            ) : null}

            <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2.5">
              <p className="text-xs font-bold text-foreground flex items-center gap-2">
                <span className="size-2 rounded-full bg-blue-500" />
                iPhone / iPad (iOS)
              </p>
              <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>
                  Tap the <strong className="text-foreground">Share</strong> button{" "}
                  <Share className="inline size-3.5 text-primary mx-0.5" /> at the bottom of Safari.
                </li>
                <li>
                  Tap <strong className="text-foreground">"Add to Home Screen"</strong>{" "}
                  <PlusSquare className="inline size-3.5 text-primary mx-0.5" /> and tap{" "}
                  <strong className="text-foreground">Add</strong>.
                </li>
              </ol>
              {ios && (
                <Button
                  onClick={handleDownloadMobileProfile}
                  variant="outline"
                  className="w-full gap-2 text-xs font-semibold mt-2"
                >
                  <Download className="size-3.5" />
                  Download iOS App Profile (.mobileconfig)
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2.5">
              <p className="text-xs font-bold text-foreground">Direct Desktop Download (1-Click)</p>
              <p className="text-xs text-muted-foreground">
                Download the standalone <strong className="text-foreground">Teals CRM Desktop</strong> launcher directly to your PC or Laptop.
              </p>
              <Button onClick={handleDownloadDesktopShortcut} className="w-full gap-2 text-xs font-semibold">
                <Download className="size-3.5" />
                Download Desktop App
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
