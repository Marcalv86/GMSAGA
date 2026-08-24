import React from 'react';

export const YouTubePreview: React.FC<{ content: string }> = ({ content }) => {
  const urlRegex =
    /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/g;
  const matches = Array.from(content.matchAll(urlRegex));
  if (!matches || matches.length === 0) return null;

  // Unique video IDs
  const uniqueVideoIds = Array.from(new Set(matches.map(m => m[1])));

  return (
    <div className="flex flex-col gap-3 mt-3">
      {uniqueVideoIds.map((videoId, i) => (
        <div
          key={i}
          className="w-full max-w-[560px] aspect-video rounded-xl overflow-hidden shadow-2xl border border-[var(--glass-border)] bg-black"
        >
          <iframe
            width="100%"
            height="100%"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      ))}
    </div>
  );
};
