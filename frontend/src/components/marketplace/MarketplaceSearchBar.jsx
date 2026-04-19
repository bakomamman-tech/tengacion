export default function MarketplaceSearchBar({
  value,
  onChange,
  onSubmit,
  placeholder = "Search products, stores, or categories",
}) {
  return (
    <form
      className="marketplace-searchbar"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <input
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        aria-label="Search marketplace"
      />
      <button type="submit" className="marketplace-primary-btn">
        Search
      </button>
    </form>
  );
}
