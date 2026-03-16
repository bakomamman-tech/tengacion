import toast from "react-hot-toast";

export default function ShareActions({
  title,
  text = "",
  url,
  className = "",
}) {
  const handleShare = async () => {
    const shareUrl = String(url || window.location.href || "").trim();
    const shareTitle = String(title || "Tengacion creator release").trim();
    const shareText = String(text || "Explore this creator release on Tengacion.").trim();

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (error?.name === "AbortError") {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied");
    } catch {
      window.prompt("Copy this Tengacion share link", shareUrl);
    }
  };

  return (
    <button type="button" className={className || "creator-share-btn"} onClick={handleShare}>
      Share
    </button>
  );
}
