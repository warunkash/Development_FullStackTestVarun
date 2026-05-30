"""
Action detection combining MMAction2-style classification and LLM-based interpretation.

Two-stage approach:
1. Heuristic/ML classification of low-level actions (strike, block, stance, verbal)
2. LLM interpretation for semantic meaning and intent
"""

import logging
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from pipeline.vision.pose_analyzer import PoseFrame, compute_movement_intensity, extract_body_posture_features

log = logging.getLogger(__name__)


@dataclass
class DetectedAction:
    action_type: str
    action_subtype: str | None
    start_time: float
    end_time: float
    confidence: float
    intensity: float
    description: str
    pose_analysis: dict = field(default_factory=dict)
    context_notes: str = ""


# Martial arts action taxonomy
MARTIAL_ARTS_ACTIONS = {
    "strike": {
        "subtypes": ["jab", "cross", "hook", "uppercut", "kick", "side_kick", "back_kick", "elbow"],
        "pose_signals": ["rapid_wrist_extension", "hip_rotation", "weight_transfer"],
    },
    "block": {
        "subtypes": ["inside_block", "outside_block", "parry", "cover", "slip"],
        "pose_signals": ["forearm_intercept", "body_rotation", "defensive_crouch"],
    },
    "stance": {
        "subtypes": ["fighting_stance", "horse_stance", "crane_stance", "neutral"],
        "pose_signals": ["weight_distribution", "guard_position", "foot_placement"],
    },
    "movement": {
        "subtypes": ["advance", "retreat", "sidestep", "circle", "pivot"],
        "pose_signals": ["hip_displacement", "weight_shift", "foot_movement"],
    },
    "combination": {
        "subtypes": ["two_punch", "kick_punch", "trapping", "flow_combination"],
        "pose_signals": ["rapid_successive_movements", "continuous_chain"],
    },
    "verbal": {
        "subtypes": ["teaching", "explaining", "demonstrating", "philosophical"],
        "pose_signals": ["minimal_movement", "hand_gestures", "upright_posture"],
    },
    "demonstration": {
        "subtypes": ["slow_form", "technique_show", "partner_drill"],
        "pose_signals": ["controlled_movement", "exaggerated_technique"],
    },
}


def classify_actions_from_poses(
    pose_frames: list[PoseFrame],
    min_segment_duration: float = 0.5,
    movement_threshold: float = 0.05,
) -> list[DetectedAction]:
    """
    Classify actions from a sequence of pose frames.

    Uses velocity analysis and posture features to identify action segments.
    """
    if not pose_frames:
        return []

    # Segment frames by movement intensity
    segments = _segment_by_movement(pose_frames, movement_threshold)

    actions = []
    for seg_start_idx, seg_end_idx in segments:
        seg_frames = pose_frames[seg_start_idx:seg_end_idx + 1]

        if not seg_frames:
            continue

        duration = seg_frames[-1].timestamp - seg_frames[0].timestamp
        if duration < min_segment_duration:
            continue

        intensity = compute_movement_intensity(seg_frames)
        action_type, subtype, confidence = _classify_segment(seg_frames, intensity)
        posture_features = {}

        if seg_frames:
            posture_features = extract_body_posture_features(seg_frames[len(seg_frames) // 2])

        actions.append(DetectedAction(
            action_type=action_type,
            action_subtype=subtype,
            start_time=seg_frames[0].timestamp,
            end_time=seg_frames[-1].timestamp,
            confidence=confidence,
            intensity=min(intensity * 10, 1.0),
            description=f"{action_type.replace('_', ' ').title()}" + (f" - {subtype}" if subtype else ""),
            pose_analysis={
                "movement_intensity": intensity,
                "posture_features": posture_features,
                "frame_count": len(seg_frames),
            },
        ))

    return actions


def _segment_by_movement(
    frames: list[PoseFrame],
    threshold: float,
) -> list[tuple[int, int]]:
    """Group consecutive frames into movement segments."""
    segments = []
    in_movement = False
    seg_start = 0

    for i, frame in enumerate(frames):
        intensity = sum(frame.velocity.values()) / max(len(frame.velocity), 1) if frame.velocity else 0.0

        if intensity > threshold and not in_movement:
            in_movement = True
            seg_start = i
        elif intensity <= threshold and in_movement:
            in_movement = False
            segments.append((seg_start, i - 1))

    if in_movement:
        segments.append((seg_start, len(frames) - 1))

    return segments


def _classify_segment(
    frames: list[PoseFrame],
    intensity: float,
) -> tuple[str, str | None, float]:
    """Classify the dominant action in a frame segment."""
    if intensity < 0.02:
        return "stance", "fighting_stance", 0.7

    mid_frame = frames[len(frames) // 2]
    kp_map = {kp.name: kp for kp in mid_frame.keypoints}

    # Check wrist velocities (high = strike/block)
    wrist_velocity = 0.0
    if mid_frame.velocity:
        wrist_velocity = max(
            mid_frame.velocity.get("left_wrist", 0),
            mid_frame.velocity.get("right_wrist", 0),
        )

    # Check ankle/foot movement (high = footwork)
    ankle_velocity = 0.0
    if mid_frame.velocity:
        ankle_velocity = max(
            mid_frame.velocity.get("left_ankle", 0),
            mid_frame.velocity.get("right_ankle", 0),
        )

    if wrist_velocity > ankle_velocity * 2 and wrist_velocity > 0.1:
        # High wrist speed relative to feet → strike or block
        if wrist_velocity > 0.3:
            return "strike", "jab", 0.65
        else:
            return "block", "parry", 0.60

    if ankle_velocity > 0.05:
        return "movement", "advance", 0.65

    if 0.02 < intensity < 0.08:
        return "demonstration", "technique_show", 0.70

    if intensity > 0.15:
        return "combination", "flow_combination", 0.60

    return "movement", "general", 0.50


def enrich_actions_with_transcript(
    actions: list[DetectedAction],
    transcript_segments: list[dict],
) -> list[DetectedAction]:
    """Add transcript context to actions occurring during speech."""
    for action in actions:
        relevant_text = []
        for seg in transcript_segments:
            seg_start = seg.get("start_time", 0)
            seg_end = seg.get("end_time", 0)

            if seg_start <= action.end_time and seg_end >= action.start_time:
                relevant_text.append(seg.get("text", ""))

        if relevant_text:
            action.context_notes = " ".join(relevant_text)
            if not any(term in action.action_type for term in ["strike", "block", "movement"]):
                action.action_type = "verbal"
                action.action_subtype = "teaching"

    return actions
