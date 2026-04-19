import ProductCard from "./ProductCard";

export default function ProductGrid({
  products = [],
  emptyTitle = "No marketplace listings yet",
  emptyCopy = "Once products go live, they will appear here.",
  manageView = false,
  onEdit,
  onPublishToggle,
  onDelete,
}) {
  if (!products.length) {
    return (
      <div className="marketplace-empty-state">
        <strong>{emptyTitle}</strong>
        <p>{emptyCopy}</p>
      </div>
    );
  }

  return (
    <div className="marketplace-product-grid">
      {products.map((product) => (
        <ProductCard
          key={product._id || product.slug}
          product={product}
          manageView={manageView}
          onEdit={onEdit}
          onPublishToggle={onPublishToggle}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
