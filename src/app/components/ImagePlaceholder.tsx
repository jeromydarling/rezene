import { useState } from "react";

/**
 * Product/editorial image with a fabric-toned editorial fallback. Seed data
 * references art-direction slots that don't have real photography yet, so
 * the fallback is a designed state, not an error state.
 */
export function EditorialImage({
  src,
  alt,
  label,
  aspect = "aspect-[4/5]",
  className = "",
}: {
  src: string | null;
  alt: string;
  label?: string;
  aspect?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;
  return (
    <div className={`relative overflow-hidden bg-sand/60 ${aspect} ${className}`}>
      {showFallback ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-cream via-sand/70 to-sand-deep/50 p-6 text-center">
          <span className="font-display text-lg font-light italic text-bark/60">
            {label ?? alt}
          </span>
          <span className="eyebrow">Photography forthcoming</span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}
