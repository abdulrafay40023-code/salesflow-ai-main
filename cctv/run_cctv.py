import cv2
import json
import os
import sys
import argparse
import time
from tracker import OfficeCCTVTracker

def load_config(config_path="config.json"):
    default_config = {
        "camera": {"source": "0", "frame_width": 1280, "frame_height": 720},
        "ai_settings": {"model_name": "yolov8n.pt", "confidence_threshold": 0.35, "track_history_length": 50},
        "display": {"show_bounding_box": True, "show_timer": True, "show_movement_trails": True, "show_stats_header": True}
    }
    if os.path.exists(config_path):
        try:
            with open(config_path, "r") as f:
                return json.load(f)
        except Exception as e:
            print(f"[WARN] Error loading config ({e}), using defaults.")
    return default_config

def main():
    parser = argparse.ArgumentParser(description="Office AI CCTV Smart Analytics & Dwell Tracker")
    parser.add_argument("--source", type=str, default=None, help="Camera index ('0'), Video file path, or RTSP stream URL")
    parser.add_argument("--model", type=str, default=None, help="YOLO model (yolov8n.pt, yolov8s.pt)")
    parser.add_argument("--save", type=str, default=None, help="Path to save output video (.mp4)")
    args = parser.parse_args()

    config = load_config("config.json")
    
    # Priority: CLI argument > config.json > default webcam
    source = args.source if args.source is not None else config.get("camera", {}).get("source", "0")
    
    # If source is a digit string like "0" or "1", convert to integer for cv2.VideoCapture
    if isinstance(source, str) and source.isdigit():
        source = int(source)

    model_name = args.model or config.get("ai_settings", {}).get("model_name", "yolov8n.pt")
    conf_thresh = config.get("ai_settings", {}).get("confidence_threshold", 0.35)
    trail_len = config.get("ai_settings", {}).get("track_history_length", 50)
    
    disp = config.get("display", {})
    show_box = disp.get("show_bounding_box", True)
    show_timer = disp.get("show_timer", True)
    show_trails = disp.get("show_movement_trails", True)
    show_stats = disp.get("show_stats_header", True)

    print("=" * 60)
    print(" 🚀 OFFICE AI CCTV ANALYTICS & DWELL TIME TRACKER")
    print(f" 📹 Video Source   : {source}")
    print(f" 🧠 AI Model       : {model_name}")
    print(f" ⌨️  Hotkeys        : [Q] Quit  |  [T] Toggle Trails  |  [B] Toggle Boxes")
    print("=" * 60)

    # Initialize Tracker
    tracker = OfficeCCTVTracker(model_name=model_name, conf_thresh=conf_thresh, trail_length=trail_len)

    # Open Video Stream
    print(f"[STREAM] Connecting to video source: {source}...")
    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print(f"[ERROR] Could not open video source: {source}")
        print("💡 Hint: If using webcam, ensure camera permissions are allowed. If RTSP, verify IP and password.")
        return

    # Video Writer if save option is enabled
    writer = None
    if args.save:
        w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 25
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(args.save, fourcc, fps, (w, h))
        print(f"[RECORDING] Saving processed output to: {args.save}")

    fps_time = time.time()
    fps_counter = 0
    current_fps = 0

    window_name = "Office AI CCTV Tracker - [Q to Exit]"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("[STREAM] Video stream ended or frame not received. Retrying...")
                time.sleep(0.5)
                # If it's a file, loop back to beginning
                if isinstance(source, str) and os.path.isfile(source):
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    break

            # Calculate FPS
            fps_counter += 1
            if time.time() - fps_time >= 1.0:
                current_fps = fps_counter
                fps_counter = 0
                fps_time = time.time()

            # Process frame with AI Tracker
            processed_frame = tracker.process_frame(
                frame,
                show_box=show_box,
                show_timer=show_timer,
                show_trails=show_trails,
                show_stats=show_stats
            )

            # Draw FPS in bottom left
            cv2.putText(processed_frame, f"FPS: {current_fps}", (15, processed_frame.shape[0] - 15),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 1, cv2.LINE_AA)

            if writer:
                writer.write(processed_frame)

            # Display Output Window
            cv2.imshow(window_name, processed_frame)

            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == 27: # 'q' or ESC to quit
                print("[EXIT] Stopping CCTV AI Tracker...")
                break
            elif key == ord('t'):
                show_trails = not show_trails
                print(f"[HOTKEY] Movement Trails: {'ON' if show_trails else 'OFF'}")
            elif key == ord('b'):
                show_box = not show_box
                print(f"[HOTKEY] Bounding Boxes: {'ON' if show_box else 'OFF'}")
            elif key == ord('s'):
                snap_path = f"snapshot_{int(time.time())}.jpg"
                cv2.imwrite(snap_path, processed_frame)
                print(f"[SNAPSHOT] Saved snapshot to: {snap_path}")

    finally:
        cap.release()
        if writer:
            writer.release()
        cv2.destroyAllWindows()
        print("[SUCCESS] Camera stream closed gracefully.")

if __name__ == "__main__":
    main()
