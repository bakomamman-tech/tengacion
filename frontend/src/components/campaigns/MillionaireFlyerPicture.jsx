export const MILLIONAIRE_FLYER_FALLBACK =
  "/assets/campaigns/tengacion-millionaire-2026-768.jpg";

const AVIF_SRC_SET =
  "/assets/campaigns/tengacion-millionaire-2026-480.avif 480w, " +
  "/assets/campaigns/tengacion-millionaire-2026-768.avif 768w, " +
  "/assets/campaigns/tengacion-millionaire-2026-1024.avif 1024w";

const WEBP_SRC_SET =
  "/assets/campaigns/tengacion-millionaire-2026-480.webp 480w, " +
  "/assets/campaigns/tengacion-millionaire-2026-768.webp 768w, " +
  "/assets/campaigns/tengacion-millionaire-2026-1024.webp 1024w";

export default function MillionaireFlyerPicture({
  className,
  loading = "lazy",
  fetchPriority = "low",
  sizes = "(max-width: 430px) calc(100vw - 36px), (max-width: 880px) min(580px, calc(100vw - 96px)), 470px",
}) {
  return (
    <picture className={className}>
      <source type="image/avif" srcSet={AVIF_SRC_SET} sizes={sizes} />
      <source type="image/webp" srcSet={WEBP_SRC_SET} sizes={sizes} />
      <img
        src={MILLIONAIRE_FLYER_FALLBACK}
        width="768"
        height="1152"
        alt="Tengacion Millionaire quiz challenge flyer"
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
      />
    </picture>
  );
}
