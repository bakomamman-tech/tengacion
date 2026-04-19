import OrderStatusBadge from "./OrderStatusBadge";

export default function StoreHeader({ seller }) {
  return (
    <section className="marketplace-store-header">
      <span className="marketplace-hero__feature-badge">Approved storefront</span>
      <h1>{seller?.storeName || "Marketplace Store"}</h1>
      <p>{seller?.about || "Trusted marketplace storefront on Tengacion."}</p>
      <div className="marketplace-store-header__meta">
        <OrderStatusBadge value={seller?.status || "approved"} />
        <span>{seller?.location?.label || "Nigeria"}</span>
        <span>{Number(seller?.summary?.publishedProducts || 0)} live products</span>
        <span>{Number(seller?.summary?.totalCompletedOrders || 0)} paid orders</span>
      </div>
    </section>
  );
}
