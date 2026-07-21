import { useEffect, useState } from 'react';

const MEDIA = {
  cn: {
    webm: '/media/engineer-service-flywheel-cn.webm',
    mp4: '/media/engineer-service-flywheel-cn.mp4',
    poster: '/media/engineer-service-flywheel-cn-poster.webp',
  },
  en: {
    webm: '/media/engineer-service-flywheel-en.webm',
    mp4: '/media/engineer-service-flywheel-en.mp4',
    poster: '/media/engineer-service-flywheel-en-poster.webp',
  },
};

export function EngineerOverviewVideo({ locale }) {
  const media = MEDIA[locale] || MEDIA.en;
  const [reduceMotion, setReduceMotion] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReduceMotion(query.matches);
    updatePreference();
    query.addEventListener?.('change', updatePreference);
    return () => query.removeEventListener?.('change', updatePreference);
  }, []);

  if (reduceMotion || videoFailed) {
    return (
      <img
        src={media.poster}
        alt=""
        aria-hidden="true"
        className="block aspect-video w-full bg-[#111722] object-contain"
      />
    );
  }

  return (
    <video
      key={locale}
      muted
      playsInline
      autoPlay={!reduceMotion}
      loop
      preload="metadata"
      poster={media.poster}
      aria-hidden="true"
      onError={() => setVideoFailed(true)}
      className="block aspect-video w-full bg-[#111722] object-contain"
    >
      <source src={media.webm} type="video/webm" />
      <source src={media.mp4} type="video/mp4" />
    </video>
  );
}
