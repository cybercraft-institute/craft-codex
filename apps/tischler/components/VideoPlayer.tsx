"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import type { VideoMode, VideoModeState } from "../lib/surface-modes/video";

export interface VideoPlayerProps {
  mode: VideoMode;
  width?: number;
  height?: number;
}

const isHlsUrl = (url: string): boolean => /\.m3u8(\?.*)?$/i.test(url);

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

/**
 * 2D HTML-Video Player für VideoMode.
 *
 * - Bei .m3u8 + Hls.isSupported() → hls.js
 * - Sonst → native video.src (Safari hat eingebauten HLS-Support, MP4/WebM)
 * - DOM-Events ↔ VideoMode-state werden bidirektional gebridged
 * - Time-Update-Throttle: max 4×/sec
 *
 * 3D-Texture (VideoTexture auf Plane via @react-three/drei) folgt in Phase D.
 */
export function VideoPlayer({
  mode,
  width = 640,
  height = 360,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastEmittedPositionRef = useRef<number>(-1);
  const lastTimeUpdateRef = useRef<number>(0);
  const [uiState, setUiState] = useState<VideoModeState>(mode.getState());

  // Re-render UI when mode-state changes.
  useEffect(() => {
    setUiState(mode.getState());
    return mode.onChange((s) => setUiState({ ...s }));
  }, [mode]);

  // Wire src → <video> + hls.js.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const url = uiState.currentSrc;
    if (!url) {
      video.removeAttribute("src");
      video.load();
      return;
    }

    let hls: Hls | null = null;

    if (isHlsUrl(url) && Hls.isSupported()) {
      hls = new Hls({ enableWorker: true });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else {
      video.src = url;
    }

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [uiState.currentSrc]);

  // Bridge DOM events → mode.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onLoadedMetadata = () => mode.setDuration(video.duration);
    const onPlay = () => mode.play();
    const onPause = () => mode.pause();
    const onTimeUpdate = () => {
      const now =
        typeof performance !== "undefined" ? performance.now() : Date.now();
      // Throttle: 4×/sec → 250ms window.
      if (now - lastTimeUpdateRef.current < 250) return;
      lastTimeUpdateRef.current = now;
      lastEmittedPositionRef.current = video.currentTime;
      mode.setPosition(video.currentTime);
    };

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);

    return () => {
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
    };
  }, [mode]);

  // Bridge mode → DOM (play/pause + seek).
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    return mode.onChange((s) => {
      // Play / pause sync.
      if (s.playing && video.paused) {
        // play() returns a promise; ignore rejections (e.g. autoplay-block).
        void video.play().catch(() => {
          /* autoplay block — user must interact */
        });
      } else if (!s.playing && !video.paused) {
        video.pause();
      }

      // Seek if external position drifts > 1s from native currentTime AND
      // it's a different value than the last time-update we emitted (avoid
      // self-seek from our own throttled timeupdate).
      const drift = Math.abs(video.currentTime - s.position);
      if (
        drift > 1 &&
        Math.abs(s.position - lastEmittedPositionRef.current) > 0.25
      ) {
        video.currentTime = s.position;
      }
    });
  }, [mode]);

  const togglePlay = () => {
    if (uiState.playing) {
      mode.pause();
    } else {
      mode.play();
    }
  };

  return (
    <div
      className="voai-video-player"
      style={{ width, display: "inline-block" }}
    >
      <video
        ref={videoRef}
        width={width}
        height={height}
        playsInline
        controls={false}
        style={{ background: "#000", display: "block", width, height }}
      />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "8px 4px",
          fontFamily: "system-ui, sans-serif",
          fontSize: 14,
        }}
      >
        <button
          type="button"
          onClick={togglePlay}
          disabled={!uiState.currentSrc}
          aria-label={uiState.playing ? "Pause" : "Play"}
          style={{
            padding: "6px 14px",
            background: "var(--cci-yellow)",
            color: "var(--color-on-accent)",
            border: "none",
            fontWeight: 600,
            cursor: uiState.currentSrc ? "pointer" : "not-allowed",
            opacity: uiState.currentSrc ? 1 : 0.5,
          }}
        >
          {uiState.playing ? "Pause" : "Play"}
        </button>
        <span style={{ color: "var(--color-text-muted)" }}>
          {formatTime(uiState.position)} / {formatTime(uiState.duration)}
        </span>
      </div>
    </div>
  );
}
