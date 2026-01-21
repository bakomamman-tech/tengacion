export default function Skeleton({ width = "100%", height = 16, radius = 8 }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, #eee 25%, #f5f5f5 37%, #eee 63%)",
        backgroundSize: "400% 100%",
        animation: "skeleton 1.4s ease infinite",
      }}
    />
  );
}
