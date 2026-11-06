import { toast } from "sonner";

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e: any) => {
    (window as any).__tealsDeferredPrompt = e;
    window.dispatchEvent(new CustomEvent("teals-pwa-ready", { detail: e }));
  });
}

export function isMobileDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || navigator.vendor || (window as any).opera || "";
  const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua) ||
    isTouchMac
  );
}

export function isIOSDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isTouchMac = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || isTouchMac;
}

export function isAndroidDevice(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

export async function triggerDirectAppInstall(
  deferredPrompt?: any,
  onInstalled?: () => void,
  _onOpenMobileDialog?: () => void
) {
  const mobile = isMobileDevice();

  // 1. On Android Phones: ALWAYS download the real signed Teals-CRM.apk directly!
  // Installing the real APK guarantees the pure Teals (T) icon on the Home Screen with ZERO small Chrome badge on any phone!
  if (isAndroidDevice()) {
    try {
      const a = document.createElement("a");
      a.href = "/Teals-CRM.apk";
      a.download = "Teals-CRM.apk";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Downloading Teals CRM App (Teals-CRM.apk)...", {
        description: "Tap 'Open' -> 'Install' when downloaded to add the pure Teals CRM App to your Home Screen.",
      });
      return true;
    } catch {}
  }

  // 2. On iPhone / iPad (iOS): Direct download of signed iOS WebClip profile
  if (mobile && isIOSDevice()) {
    try {
      const a = document.createElement("a");
      a.href = "/Teals-CRM.mobileconfig";
      a.download = "Teals-CRM.mobileconfig";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success("Teals CRM iOS App downloading...");
      return true;
    } catch {}
  }

  // 3. On PC / Laptop: Try native 1-click Desktop App install first
  let promptEvent =
    deferredPrompt || (typeof window !== "undefined" ? (window as any).__tealsDeferredPrompt : null);

  if (!promptEvent && typeof window !== "undefined") {
    await new Promise((resolve) => setTimeout(resolve, 200));
    promptEvent = (window as any).__tealsDeferredPrompt;
  }

  if (promptEvent) {
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      (window as any).__tealsDeferredPrompt = null;
      if (choice?.outcome === "accepted") {
        onInstalled?.();
        toast.success("Teals CRM App installed to your Desktop!");
        return true;
      }
      return false;
    } catch (e) {
      console.error("Native install notice:", e);
    }
  }

  // 4. PC / Laptop Direct Installer Fallback: Places Teals CRM icon on Windows Desktop & opens standalone app
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
    aBat.download = "Teals CRM.bat";
    document.body.appendChild(aBat);
    aBat.click();
    document.body.removeChild(aBat);
    URL.revokeObjectURL(urlBat);

    toast.success("Teals CRM Desktop App downloaded!", {
      description: "Open 'Teals CRM.bat' once — it puts the Teals CRM icon directly on your Desktop and opens the app.",
    });
    return true;
  } catch (err) {
    toast.error("Could not download desktop app.");
    return false;
  }
}
