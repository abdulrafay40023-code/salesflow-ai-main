// Zoom API Service using official Server-to-Server OAuth Credentials
const ZOOM_ACCOUNT_ID = "8lNkxwipQf6trITrw1-_NA";
const ZOOM_CLIENT_ID = "K2m6SbqPQlCzK354EmgePw";
const ZOOM_CLIENT_SECRET = "7CwGWoM7Uzjr8XPCfdnoHJEI28P2gVIc";

export type ZoomMeetingResult = {
  success: boolean;
  joinUrl: string;
  startUrl?: string;
  meetingId?: string;
  password?: string;
};

/**
 * Automatically creates a live unique Zoom Meeting via Server-to-Server OAuth
 */
export async function createZoomMeeting({
  topic,
  startTimeIso,
  durationMinutes = 30,
}: {
  topic: string;
  startTimeIso?: string;
  durationMinutes?: number;
}): Promise<ZoomMeetingResult> {
  try {
    const authHeader = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64");

    // 1. Obtain Access Token from Zoom OAuth
    const tokenRes = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authHeader}`,
        },
      }
    );

    const tokenData = await tokenRes.json();
    if (!tokenData.access_token) {
      console.error("Zoom OAuth Token Error:", tokenData);
      throw new Error(tokenData.reason || "Failed to get Zoom OAuth token");
    }

    const accessToken = tokenData.access_token;

    // 2. Create Meeting via Zoom REST API
    const meetingRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: topic || "Teals CRM Sales Meeting",
        type: 2, // Scheduled meeting
        start_time: startTimeIso || new Date().toISOString(),
        duration: durationMinutes,
        timezone: "Asia/Karachi",
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: true,
          waiting_room: false,
        },
      }),
    });

    const meetingData = await meetingRes.json();
    if (meetingData && meetingData.join_url) {
      return {
        success: true,
        joinUrl: meetingData.join_url,
        startUrl: meetingData.start_url,
        meetingId: String(meetingData.id || ""),
        password: meetingData.password || "",
      };
    } else {
      console.error("Zoom Meeting Creation Failed:", meetingData);
      throw new Error(meetingData.message || "Zoom meeting response missing join_url");
    }
  } catch (err: any) {
    console.error("createZoomMeeting exception:", err);
    // Return fallback Zoom Personal Room URL if API call fails
    return {
      success: false,
      joinUrl: "https://zoom.us/j/5539578967",
    };
  }
}
