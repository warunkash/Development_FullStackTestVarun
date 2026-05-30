"""
Pose analysis pipeline combining MediaPipe Holistic and YOLO11-pose.

MediaPipe: Single-person, high-detail (hands, face, body)
YOLO11: Multi-person, robust detection under occlusion
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

log = logging.getLogger(__name__)


@dataclass
class Keypoint:
    name: str
    x: float       # normalized 0-1
    y: float       # normalized 0-1
    z: float       # depth (when available)
    visibility: float


@dataclass
class PoseFrame:
    timestamp: float
    person_index: int
    keypoints: list[Keypoint]
    confidence: float
    bbox: tuple[float, float, float, float] | None  # x1, y1, x2, y2
    velocity: dict[str, float] = field(default_factory=dict)
    acceleration: dict[str, float] = field(default_factory=dict)


MEDIAPIPE_LANDMARK_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_pinky", "right_pinky",
    "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee",
    "left_ankle", "right_ankle", "left_heel", "right_heel",
    "left_foot_index", "right_foot_index",
]

YOLO_KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle",
]


class PoseAnalyzer:
    def __init__(self, device: str = "cuda", use_yolo: bool = True):
        self.device = device
        self.use_yolo = use_yolo
        self._mp_model = None
        self._yolo_model = None

    def _get_mediapipe(self):
        if self._mp_model is None:
            try:
                import mediapipe as mp
                self._mp_model = mp.solutions.pose.Pose(
                    static_image_mode=False,
                    model_complexity=2,
                    smooth_landmarks=True,
                    enable_segmentation=False,
                    min_detection_confidence=0.5,
                    min_tracking_confidence=0.5,
                )
                log.info("MediaPipe Pose loaded")
            except ImportError:
                log.warning("MediaPipe not available")
        return self._mp_model

    def _get_yolo(self):
        if self._yolo_model is None and self.use_yolo:
            try:
                from ultralytics import YOLO
                self._yolo_model = YOLO("yolo11x-pose.pt")
                log.info("YOLO11-pose loaded")
            except (ImportError, Exception) as e:
                log.warning("YOLO not available: %s", e)
        return self._yolo_model

    def analyze_frame(self, frame: np.ndarray, timestamp: float) -> list[PoseFrame]:
        """Analyze a single video frame for pose keypoints."""
        results = []

        mp_model = self._get_mediapipe()
        if mp_model:
            mp_result = self._analyze_mediapipe(frame, timestamp, mp_model)
            if mp_result:
                results.append(mp_result)

        yolo_model = self._get_yolo()
        if yolo_model and not results:
            yolo_results = self._analyze_yolo(frame, timestamp, yolo_model)
            results.extend(yolo_results)

        return results

    def _analyze_mediapipe(self, frame: np.ndarray, timestamp: float, model) -> PoseFrame | None:
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = model.process(rgb_frame)

        if not result.pose_landmarks:
            return None

        keypoints = []
        for i, landmark in enumerate(result.pose_landmarks.landmark):
            keypoints.append(Keypoint(
                name=MEDIAPIPE_LANDMARK_NAMES[i] if i < len(MEDIAPIPE_LANDMARK_NAMES) else f"landmark_{i}",
                x=landmark.x,
                y=landmark.y,
                z=landmark.z,
                visibility=landmark.visibility,
            ))

        avg_visibility = sum(kp.visibility for kp in keypoints) / len(keypoints)

        return PoseFrame(
            timestamp=timestamp,
            person_index=0,
            keypoints=keypoints,
            confidence=avg_visibility,
            bbox=None,
        )

    def _analyze_yolo(self, frame: np.ndarray, timestamp: float, model) -> list[PoseFrame]:
        results = model(frame, verbose=False, conf=0.3)
        frames = []

        for result in results:
            if result.keypoints is None:
                continue

            for person_idx, (kps, box) in enumerate(
                zip(result.keypoints.data, result.boxes.xyxyn)
            ):
                keypoints = []
                for i, kp in enumerate(kps):
                    x, y, conf = kp[0].item(), kp[1].item(), kp[2].item()
                    keypoints.append(Keypoint(
                        name=YOLO_KEYPOINT_NAMES[i] if i < len(YOLO_KEYPOINT_NAMES) else f"kp_{i}",
                        x=x,
                        y=y,
                        z=0.0,
                        visibility=conf,
                    ))

                avg_conf = sum(kp.visibility for kp in keypoints) / max(len(keypoints), 1)
                bbox = tuple(box.cpu().numpy().tolist())

                frames.append(PoseFrame(
                    timestamp=timestamp,
                    person_index=person_idx,
                    keypoints=keypoints,
                    confidence=avg_conf,
                    bbox=bbox,
                ))

        return frames

    def analyze_video_segment(
        self,
        video_path: Path,
        start_time: float,
        end_time: float,
        sample_fps: float = 5.0,
    ) -> list[PoseFrame]:
        """Analyze pose across a video segment at sampled framerate."""
        cap = cv2.VideoCapture(str(video_path))
        video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0

        frame_interval = int(video_fps / sample_fps)
        start_frame = int(start_time * video_fps)
        end_frame = int(end_time * video_fps)

        cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)

        all_frames = []
        frame_idx = start_frame

        while frame_idx < end_frame:
            ret, frame = cap.read()
            if not ret:
                break

            if (frame_idx - start_frame) % frame_interval == 0:
                timestamp = frame_idx / video_fps
                pose_frames = self.analyze_frame(frame, timestamp)
                all_frames.extend(pose_frames)

            frame_idx += 1

        cap.release()

        # Compute velocities
        self._compute_velocities(all_frames)

        return all_frames

    def _compute_velocities(self, frames: list[PoseFrame]) -> None:
        """Compute per-keypoint velocity and acceleration between frames."""
        if len(frames) < 2:
            return

        for i in range(1, len(frames)):
            prev, curr = frames[i - 1], frames[i]
            if prev.person_index != curr.person_index:
                continue

            dt = curr.timestamp - prev.timestamp
            if dt <= 0:
                continue

            prev_kp = {kp.name: kp for kp in prev.keypoints}
            curr_kp = {kp.name: kp for kp in curr.keypoints}

            velocities = {}
            for name, kp in curr_kp.items():
                if name in prev_kp:
                    dx = kp.x - prev_kp[name].x
                    dy = kp.y - prev_kp[name].y
                    speed = np.sqrt(dx**2 + dy**2) / dt
                    velocities[name] = float(speed)

            curr.velocity = velocities


def compute_movement_intensity(frames: list[PoseFrame]) -> float:
    """Compute overall movement intensity from a sequence of pose frames."""
    if not frames:
        return 0.0

    all_velocities = []
    for frame in frames:
        if frame.velocity:
            all_velocities.extend(frame.velocity.values())

    if not all_velocities:
        return 0.0

    return float(np.mean(all_velocities))


def extract_body_posture_features(frame: PoseFrame) -> dict:
    """Extract high-level posture features from a pose frame."""
    kp_map = {kp.name: kp for kp in frame.keypoints}
    features = {}

    # Stance width (hip distance)
    if "left_hip" in kp_map and "right_hip" in kp_map:
        lh, rh = kp_map["left_hip"], kp_map["right_hip"]
        features["stance_width"] = abs(lh.x - rh.x)

    # Guard height (wrist vs shoulder)
    if "left_wrist" in kp_map and "left_shoulder" in kp_map:
        lw, ls = kp_map["left_wrist"], kp_map["left_shoulder"]
        features["left_guard_height"] = ls.y - lw.y  # positive = wrist above shoulder

    # Weight distribution (hip vs ankle positions)
    if all(k in kp_map for k in ["left_hip", "right_hip", "left_ankle", "right_ankle"]):
        hip_center_x = (kp_map["left_hip"].x + kp_map["right_hip"].x) / 2
        ankle_center_x = (kp_map["left_ankle"].x + kp_map["right_ankle"].x) / 2
        features["weight_forward"] = float(hip_center_x > ankle_center_x)

    # Body lean angle
    if "left_shoulder" in kp_map and "right_shoulder" in kp_map:
        ls, rs = kp_map["left_shoulder"], kp_map["right_shoulder"]
        if ls.x != rs.x:
            angle = np.arctan2(ls.y - rs.y, ls.x - rs.x)
            features["shoulder_angle_deg"] = float(np.degrees(angle))

    return features
