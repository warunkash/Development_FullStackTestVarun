"""Unit tests for action detection pipeline."""

import pytest

from pipeline.action.action_detector import (
    _classify_segment,
    _segment_by_movement,
    classify_actions_from_poses,
    enrich_actions_with_transcript,
)
from pipeline.vision.pose_analyzer import Keypoint, PoseFrame


def make_pose_frame(timestamp: float, velocity: dict | None = None) -> PoseFrame:
    keypoints = [
        Keypoint(name="nose", x=0.5, y=0.3, z=0.0, visibility=0.9),
        Keypoint(name="left_shoulder", x=0.4, y=0.5, z=0.0, visibility=0.9),
        Keypoint(name="right_shoulder", x=0.6, y=0.5, z=0.0, visibility=0.9),
        Keypoint(name="left_wrist", x=0.3, y=0.7, z=0.0, visibility=0.8),
        Keypoint(name="right_wrist", x=0.7, y=0.7, z=0.0, visibility=0.8),
        Keypoint(name="left_hip", x=0.4, y=0.7, z=0.0, visibility=0.9),
        Keypoint(name="right_hip", x=0.6, y=0.7, z=0.0, visibility=0.9),
        Keypoint(name="left_ankle", x=0.35, y=0.95, z=0.0, visibility=0.85),
        Keypoint(name="right_ankle", x=0.65, y=0.95, z=0.0, visibility=0.85),
    ]
    return PoseFrame(
        timestamp=timestamp,
        person_index=0,
        keypoints=keypoints,
        confidence=0.85,
        bbox=None,
        velocity=velocity or {},
        acceleration={},
    )


class TestSegmentByMovement:
    def test_no_movement_no_segments(self):
        frames = [make_pose_frame(i * 0.1) for i in range(10)]
        segments = _segment_by_movement(frames, threshold=0.05)
        assert len(segments) == 0

    def test_high_movement_creates_segment(self):
        frames = []
        for i in range(10):
            vel = {"left_wrist": 0.5, "right_wrist": 0.3} if 3 <= i <= 7 else {}
            frames.append(make_pose_frame(i * 0.1, velocity=vel))

        segments = _segment_by_movement(frames, threshold=0.05)
        assert len(segments) >= 1

    def test_segment_boundaries_correct(self):
        frames = []
        for i in range(10):
            vel = {"left_wrist": 0.5} if 2 <= i <= 6 else {}
            frames.append(make_pose_frame(i * 0.1, velocity=vel))

        segments = _segment_by_movement(frames, threshold=0.05)
        assert len(segments) > 0
        start, end = segments[0]
        assert start == 2
        assert end == 6


class TestClassifySegment:
    def test_high_wrist_speed_gives_strike(self):
        frames = [make_pose_frame(0.0, velocity={"left_wrist": 0.5, "right_wrist": 0.4})]
        action_type, subtype, confidence = _classify_segment(frames, intensity=0.4)
        assert action_type == "strike"
        assert confidence > 0.5

    def test_low_movement_gives_stance(self):
        frames = [make_pose_frame(0.0)]
        action_type, _, _ = _classify_segment(frames, intensity=0.01)
        assert action_type == "stance"

    def test_ankle_movement_gives_footwork(self):
        frames = [make_pose_frame(0.0, velocity={"left_ankle": 0.3, "right_ankle": 0.2, "left_wrist": 0.02})]
        action_type, _, _ = _classify_segment(frames, intensity=0.2)
        assert action_type == "movement"


class TestClassifyActionsFromPoses:
    def test_empty_frames_returns_empty(self):
        result = classify_actions_from_poses([])
        assert result == []

    def test_static_frames_minimal_actions(self):
        frames = [make_pose_frame(i * 0.2) for i in range(5)]
        result = classify_actions_from_poses(frames, movement_threshold=0.05)
        assert isinstance(result, list)

    def test_dynamic_frames_detect_actions(self):
        frames = []
        for i in range(20):
            is_active = 5 <= i <= 12
            vel = {"left_wrist": 0.5 if is_active else 0.0,
                   "right_wrist": 0.3 if is_active else 0.0}
            frames.append(make_pose_frame(i * 0.2, velocity=vel))

        result = classify_actions_from_poses(frames, movement_threshold=0.05)
        assert len(result) >= 1


class TestEnrichActionsWithTranscript:
    def test_adds_transcript_context(self):
        actions = [
            type('Action', (), {
                'action_type': 'verbal',
                'action_subtype': None,
                'start_time': 0.0,
                'end_time': 5.0,
                'context_notes': '',
                '__dict__': {},
            })()
        ]

        actions[0].context_notes = ''
        actions[0].action_type = 'verbal'

        from pipeline.action.action_detector import DetectedAction
        real_action = DetectedAction(
            action_type='movement',
            action_subtype=None,
            start_time=1.0,
            end_time=4.0,
            confidence=0.7,
            intensity=0.3,
            description='test',
        )

        segments = [
            {"start_time": 0.0, "end_time": 5.0, "text": "Be like water"}
        ]

        result = enrich_actions_with_transcript([real_action], segments)
        assert result[0].context_notes == "Be like water"

    def test_no_overlap_no_enrichment(self):
        from pipeline.action.action_detector import DetectedAction
        action = DetectedAction(
            action_type='strike',
            action_subtype='jab',
            start_time=10.0,
            end_time=11.0,
            confidence=0.8,
            intensity=0.9,
            description='jab',
        )

        segments = [{"start_time": 0.0, "end_time": 5.0, "text": "Some speech"}]
        result = enrich_actions_with_transcript([action], segments)
        assert result[0].context_notes == ''
