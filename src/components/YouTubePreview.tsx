import React from 'react';
import { leerEnlacesDeYouTube } from '../utils/youtube';

export const YouTubePreview: React.FC<{ content: string }> = ({ content }) => {
  /*
   * El mismo reconocedor que usa el envío al modelo.
   *
   * Tenía el suyo propio, ligeramente distinto, y eso significaba que un enlace
   * podía pintarse aquí y no llegar al Director, o al revés. Un enlace, una
   * verdad.
   */
  const videos = leerEnlacesDeYouTube(content);
  if (videos.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 mt-3">
      {videos.map(({ id: videoId }, i) => (
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
