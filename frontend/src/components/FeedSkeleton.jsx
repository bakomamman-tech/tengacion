import Skeleton from "./Skeleton";

export default function FeedSkeleton() {
  return (
    <div className="card">
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <Skeleton width={40} height={40} radius={20} />
        <div style={{ flex: 1 }}>
          <Skeleton width="40%" />
          <Skeleton width="60%" height={12} />
        </div>
      </div>

      <Skeleton width="100%" height={120} radius={10} />
    </div>
  );
}
