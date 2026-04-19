import MarketplaceDeliveryFilter from "./MarketplaceDeliveryFilter";
import MarketplaceLocationFilter from "./MarketplaceLocationFilter";
import MarketplaceSearchBar from "./MarketplaceSearchBar";

export default function MarketplaceFilters({
  filters,
  categories = [],
  onFiltersChange,
  onSearchSubmit,
  onReset,
}) {
  const update = (key, value) => onFiltersChange?.({ ...filters, [key]: value });

  return (
    <section className="marketplace-filters">
      <MarketplaceSearchBar
        value={filters.search || ""}
        onChange={(value) => update("search", value)}
        onSubmit={onSearchSubmit}
      />

      <div className="marketplace-filter-grid">
        <div className="marketplace-filter">
          <label htmlFor="marketplace-filter-category">Category</label>
          <select
            id="marketplace-filter-category"
            value={filters.category || ""}
            onChange={(event) => update("category", event.target.value)}
          >
            <option value="">All categories</option>
            {(Array.isArray(categories) ? categories : []).map((category) => {
              const value = typeof category === "string" ? category : category.value;
              const label = typeof category === "string" ? category : category.value;
              return (
                <option key={value} value={value}>
                  {label}
                </option>
              );
            })}
          </select>
        </div>

        <MarketplaceLocationFilter
          stateValue={filters.state || ""}
          cityValue={filters.city || ""}
          onStateChange={(value) => update("state", value)}
          onCityChange={(value) => update("city", value)}
        />

        <MarketplaceDeliveryFilter
          value={filters.deliveryOption || ""}
          onChange={(value) => update("deliveryOption", value)}
        />
      </div>

      <div className="marketplace-inline-actions">
        <button type="button" className="marketplace-primary-btn" onClick={onSearchSubmit}>
          Apply filters
        </button>
        <button type="button" className="marketplace-ghost-btn" onClick={onReset}>
          Reset
        </button>
      </div>
    </section>
  );
}
