# 🎥 Office AI CCTV Smart Analytics & Dwell Tracker

Ye software aapke Office CCTV Cameras ya Webcam par **NeuroSpot AI** ki tarah live people detection, dwell time tracking aur movement squiggly lines draw karta hai.

---

## 📁 Files in this folder (`cctv/`):
* `tracker.py` : Core AI Computer Vision & YOLOv8 ByteTrack engine.
* `run_cctv.py` : Main runner script with live video window.
* `config.json` : Settings file (Camera RTSP link, model thresholds, display options).

---

## 🚀 How to Run:

### 1. Test with Laptop Webcam:
```bash
python run_cctv.py --source 0
```

### 2. Test with Office CCTV Camera (RTSP Link):
```bash
python run_cctv.py --source "rtsp://admin:password@192.168.1.50:554/ch1"
```
*(Ya `config.json` file open karke `"source"` mein apna RTSP link daal dein).*

### 3. Test with a Video File:
```bash
python run_cctv.py --source "office_sample.mp4"
```

---

## ⌨️ Live Keyboard Hotkeys:
* `Q` ya `ESC` : Software band / exit karne ke liye.
* `T` : Movement squiggly path lines ko ON / OFF karne ke liye.
* `B` : Bounding boxes ko ON / OFF karne ke liye.
* `S` : Live snapshot image save karne ke liye.
