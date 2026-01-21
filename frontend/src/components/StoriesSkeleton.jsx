import Skeleton from "./Skeleton";

export default function StoriesSkeleton() {
  return (
    <div style={{ display: "flex", gap: 10, padding: 10 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} width={80} height={140} radius={12} />
      ))}
    </div>
  );
}
