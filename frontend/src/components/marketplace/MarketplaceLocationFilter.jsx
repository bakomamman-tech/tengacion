export default function MarketplaceLocationFilter({
  stateValue = "",
  cityValue = "",
  onStateChange,
  onCityChange,
}) {
  return (
    <>
      <div className="marketplace-filter">
        <label htmlFor="marketplace-filter-state">State</label>
        <input
          id="marketplace-filter-state"
          value={stateValue}
          onChange={(event) => onStateChange?.(event.target.value)}
          placeholder="Lagos"
        />
      </div>
      <div className="marketplace-filter">
        <label htmlFor="marketplace-filter-city">City</label>
        <input
          id="marketplace-filter-city"
          value={cityValue}
          onChange={(event) => onCityChange?.(event.target.value)}
          placeholder="Ikeja"
        />
      </div>
    </>
  );
}
