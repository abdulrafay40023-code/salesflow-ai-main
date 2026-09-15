import time
import cv2
import numpy as np
from collections import defaultdict
from ultralytics import YOLO

def format_duration(seconds: float) -> str:
    """Format seconds into readable human format: Xh Ym or Xm Ys or Xs"""
    seconds = int(seconds)
    if seconds < 60:
        return f"{seconds}s"
    elif seconds < 3600:
        mins = seconds // 60
        secs = seconds % 60
        return f"{mins}m {secs:02d}s"
    else:
        hours = seconds // 3600
        mins = (seconds % 3600) // 60
        return f"{hours}h {mins:02d}m"

def get_color_for_id(track_id: int):
    """Generate consistent aesthetic colors per person ID"""
    np.random.seed(int(track_id) * 31)
    color = np.random.randint(50, 255, size=3).tolist()
    return (int(color[0]), int(color[1]), int(color[2]))

class OfficeCCTVTracker:
    def __init__(self, model_name="yolov8n.pt", conf_thresh=0.35, trail_length=50):
        print(f"[AI ENGINE] Loading YOLOv8 model: {model_name}...")
        self.model = YOLO(model_name)
        self.conf_thresh = conf_thresh
        self.trail_length = trail_length
        
        # Track memory: track_id -> metadata
        self.people_tracks = {} # track_id -> {"first_seen": float, "last_seen": float, "positions": [(x,y)], "color": (b,g,r)}
        self.active_ids = set()
        self.total_unique_visitors = 0
        
    def process_frame(self, frame, show_box=True, show_timer=True, show_trails=True, show_stats=True):
        current_time = time.time()
        
        # Run YOLOv8 Tracking with ByteTrack on Person class (cls=0)
        results = self.model.track(
            frame,
            classes=[0],          # 0 = Person class in COCO
            conf=self.conf_thresh,
            persist=True,
            verbose=False
        )
        
        annotated_frame = frame.copy()
        current_frame_ids = set()
        
        if results and len(results) > 0 and results[0].boxes is not None and results[0].boxes.id is not None:
            boxes = results[0].boxes.xyxy.cpu().numpy().astype(int)
            track_ids = results[0].boxes.id.cpu().numpy().astype(int)
            confs = results[0].boxes.conf.cpu().numpy()
            
            for box, track_id, conf in zip(boxes, track_ids, confs):
                current_frame_ids.add(track_id)
                x1, y1, x2, y2 = box
                center_x = int((x1 + x2) / 2)
                center_y = int(y2) # Bottom center for realistic footstep tracking
                
                # Initialize new person tracking
                if track_id not in self.people_tracks:
                    self.total_unique_visitors += 1
                    self.people_tracks[track_id] = {
                        "first_seen": current_time,
                        "last_seen": current_time,
                        "positions": [],
                        "color": get_color_for_id(track_id)
                    }
                
                track_info = self.people_tracks[track_id]
                track_info["last_seen"] = current_time
                track_info["positions"].append((center_x, center_y))
                
                # Keep trails to specified length
                if len(track_info["positions"]) > self.trail_length:
                    track_info["positions"].pop(0)
                
                dwell_seconds = current_time - track_info["first_seen"]
                dwell_str = format_duration(dwell_seconds)
                person_color = track_info["color"]
                
                # 1. DRAW MOVEMENT TRAILS (Squiggly / Path Lines)
                if show_trails and len(track_info["positions"]) > 1:
                    points = np.array(track_info["positions"], dtype=np.int32).reshape((-1, 1, 2))
                    cv2.polylines(annotated_frame, [points], isClosed=False, color=person_color, thickness=3, lineType=cv2.LINE_AA)
                
                # 2. DRAW NEON BOUNDING BOX
                if show_box:
                    # Aesthetic corner box styling
                    box_color = (0, 255, 128) if dwell_seconds < 300 else (0, 200, 255) if dwell_seconds < 1800 else (0, 100, 255)
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), box_color, 2, cv2.LINE_AA)
                    
                    # Corner accents
                    c_len = min(20, (x2 - x1) // 4, (y2 - y1) // 4)
                    cv2.line(annotated_frame, (x1, y1), (x1 + c_len, y1), (255, 255, 255), 3)
                    cv2.line(annotated_frame, (x1, y1), (x1, y1 + c_len), (255, 255, 255), 3)
                    cv2.line(annotated_frame, (x2, y1), (x2 - c_len, y1), (255, 255, 255), 3)
                    cv2.line(annotated_frame, (x2, y1), (x2, y1 + c_len), (255, 255, 255), 3)
                    cv2.line(annotated_frame, (x1, y2), (x1 + c_len, y2), (255, 255, 255), 3)
                    cv2.line(annotated_frame, (x1, y2), (x1, y2 - c_len), (255, 255, 255), 3)
                    cv2.line(annotated_frame, (x2, y2), (x2 - c_len, y2), (255, 255, 255), 3)
                    cv2.line(annotated_frame, (x2, y2), (x2, y2 - c_len), (255, 255, 255), 3)
                
                # 3. DRAW DWELL TIME BADGE & LABEL
                if show_timer:
                    label = f"ID #{track_id} | {dwell_str}"
                    (text_w, text_h), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
                    
                    # Badge background
                    bg_y1 = max(0, y1 - text_h - 12)
                    bg_y2 = y1
                    cv2.rectangle(annotated_frame, (x1, bg_y1), (x1 + text_w + 14, bg_y2), (20, 20, 25), -1)
                    cv2.rectangle(annotated_frame, (x1, bg_y1), (x1 + text_w + 14, bg_y2), box_color, 1)
                    
                    # Text inside badge
                    cv2.putText(annotated_frame, label, (x1 + 7, y1 - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
        
        self.active_ids = current_frame_ids
        
        # 4. DRAW TOP HUD / STATS BANNER
        if show_stats:
            h, w = annotated_frame.shape[:2]
            
            # Semi-transparent dark header banner
            overlay = annotated_frame.copy()
            cv2.rectangle(overlay, (0, 0), (w, 55), (15, 18, 25), -1)
            cv2.addWeighted(overlay, 0.85, annotated_frame, 0.15, 0, annotated_frame)
            cv2.line(annotated_frame, (0, 55), (w, 55), (0, 255, 128), 1)
            
            # Statistics text
            active_count = len(self.active_ids)
            stats_text_1 = f"LIVE PEOPLE: {active_count}"
            stats_text_2 = f"TOTAL DETECTED TODAY: {self.total_unique_visitors}"
            
            # Calculate average dwell time for active people
            avg_dwell = 0
            if active_count > 0:
                dwells = [current_time - self.people_tracks[tid]["first_seen"] for tid in self.active_ids if tid in self.people_tracks]
                avg_dwell = sum(dwells) / len(dwells) if dwells else 0
            stats_text_3 = f"AVG DWELL: {format_duration(avg_dwell)}"
            
            cv2.putText(annotated_frame, "[AI CCTV PRO]", (15, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 128), 2, cv2.LINE_AA)
            cv2.putText(annotated_frame, stats_text_1, (200, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 2, cv2.LINE_AA)
            cv2.putText(annotated_frame, stats_text_2, (420, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 220, 255), 2, cv2.LINE_AA)
            cv2.putText(annotated_frame, stats_text_3, (740, 35), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 200, 255), 2, cv2.LINE_AA)
            
        return annotated_frame
