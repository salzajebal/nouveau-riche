export function SiteLogoBadge({ className = "", size = 32 }: { className?: string; size?: number }) {
  return (
    <img
      src="/nouveau-riche-logo.png"
      alt="NOUVEAU RICHE"
      height={size * 0.69}
      style={{
        height: size * 0.69,
        width: "auto",
        maxWidth: "none",
        flexShrink: 0,
        objectFit: "contain",
        display: "inline-block",
      }}
      className={className}
    />
  );
}

export function SiteLogo({ className = "" }: { className?: string }) {
  return <SiteLogoBadge size={32} className={className} />;
}
