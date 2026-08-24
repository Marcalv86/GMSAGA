import React from "react";

export const SpotifyPreview: React.FC<{ content: string }> = ({ content }) => {
  const spotifyRegex =
    /(https?:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|artist|episode)\/[\w-]+)/g;
  const matches = content.match(spotifyRegex);
  if (!matches || matches.length === 0) return null;

  const uniqueUrls = Array.from(new Set(matches));

  return (
    <div className="flex flex-col gap-3 mt-3">
      {uniqueUrls.map((url, i) => {
        const embedUrl = url.replace(
          "open.spotify.com",
          "open.spotify.com/embed",
        );
        return (
          <div
            key={i}
            className="w-full max-w-[560px] rounded-xl overflow-hidden shadow-2xl border border-[var(--glass-border)]"
          >
            <iframe
              src={embedUrl}
              width="100%"
              height="152"
              allow="encrypted-media"
              allowFullScreen
            />
          </div>
        );
      })}
    </div>
  );
};
