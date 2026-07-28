"use client";

import { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

export default function VideoPlayer({ src, title }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);

  useEffect(() => {
    if (!playerRef.current && videoRef.current) {
      const el = document.createElement("video-js");
      el.classList.add("vjs-big-play-centered", "vjs-theme-shelf");
      videoRef.current.appendChild(el);

      playerRef.current = videojs(el, {
        controls: true,
        responsive: true,
        fluid: true,
        preload: "auto",
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        sources: [{ src, type: "video/mp4" }],
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div data-vjs-player className="w-full rounded-xl overflow-hidden bg-black">
      <div ref={videoRef} />
    </div>
  );
      }
