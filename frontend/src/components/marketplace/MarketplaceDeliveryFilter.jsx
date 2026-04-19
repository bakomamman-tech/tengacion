import { MARKETPLACE_DELIVERY_OPTIONS } from "../../services/marketplaceService";

export default function MarketplaceDeliveryFilter({ value = "", onChange }) {
  return (
    <div className="marketplace-filter">
      <label htmlFor="marketplace-filter-delivery">Delivery</label>
      <select
        id="marketplace-filter-delivery"
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      >
        <option value="">All delivery types</option>
        {MARKETPLACE_DELIVERY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
