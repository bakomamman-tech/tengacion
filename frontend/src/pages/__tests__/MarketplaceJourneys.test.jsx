import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useAuth } from "../../context/AuthContext";
import { initializeMarketplacePayment } from "../../services/marketplaceOrderService";
import {
  fetchMarketplaceHome,
  fetchMarketplaceProductDetail,
} from "../../services/marketplaceService";
import MarketplacePage from "../MarketplacePage";
import MarketplaceProductDetailsPage from "../MarketplaceProductDetailsPage";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));

vi.mock("react-hot-toast", () => ({
  default: { error: toastError, success: vi.fn() },
}));

vi.mock("../../context/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../services/marketplaceService", async () => {
  const actual = await vi.importActual("../../services/marketplaceService");
  return {
    ...actual,
    fetchMarketplaceHome: vi.fn(),
    fetchMarketplaceProductDetail: vi.fn(),
  };
});

vi.mock("../../services/marketplaceOrderService", () => ({
  initializeMarketplacePayment: vi.fn(),
}));

vi.mock("../../components/QuickAccessLayout", () => ({
  default: ({ children }) => <div>{children}</div>,
}));

vi.mock("../../components/marketplace/MarketplaceIcon", () => ({
  default: ({ name }) => <span aria-hidden="true">{name}</span>,
}));

vi.mock("../../components/marketplace/ProductGrid", () => ({
  default: ({ products = [] }) => (
    <div>{products.map((product) => <span key={product._id}>{product.title}</span>)}</div>
  ),
}));

vi.mock("../../components/marketplace/OrderStatusBadge", () => ({
  default: ({ value }) => <span>{value}</span>,
}));

vi.mock("../../components/payments/PaymentTrustPanel", () => ({ default: () => null }));
vi.mock("../../components/payments/PaymentSummaryPanel", () => ({ default: () => null }));
vi.mock("../../components/payments/PaystackSecureBadge", () => ({ default: () => null }));
vi.mock("../../components/payments/PaymentRecoveryNotice", () => ({
  default: ({ message }) => <p role="alert">{message}</p>,
}));
vi.mock("../../components/seo/SeoHead", () => ({ default: () => null }));

const marketplacePayload = {
  products: [
    {
      _id: "product-1",
      slug: "kaduna-laptop-bag",
      title: "Kaduna Laptop Bag",
      price: 12500,
      state: "Kaduna",
      city: "Kaduna",
      seller: { _id: "seller-1", storeName: "Northern Craft" },
    },
  ],
  featuredProducts: [],
  latestProducts: [],
  trendingSellers: [],
  categories: ["Fashion"],
  total: 1,
};

describe("Marketplace high-risk journeys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { _id: "buyer-1" } });
    vi.mocked(fetchMarketplaceHome).mockResolvedValue(marketplacePayload);
  });

  it("loads server listings and sends the buyer's filters back to the marketplace API", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <MarketplacePage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Kaduna Laptop Bag")).toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "Search Marketplace" });
    await user.type(search, "laptop bag");
    await user.click(screen.getByRole("button", { name: /^Search$/ }));

    await waitFor(() => {
      expect(fetchMarketplaceHome).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: "laptop bag", sort: "latest" })
      );
    });
  });

  it("shows a durable checkout recovery state when payment initialization fails", async () => {
    const user = userEvent.setup();
    vi.mocked(fetchMarketplaceProductDetail).mockResolvedValue({
      product: {
        _id: "product-1",
        slug: "kaduna-laptop-bag",
        title: "Kaduna Laptop Bag",
        description: "Handmade laptop bag",
        category: "Fashion",
        condition: "new",
        price: 12500,
        currency: "NGN",
        stock: 4,
        images: [{ url: "https://example.com/bag.jpg" }],
        deliveryOptions: ["pickup"],
        location: { label: "Kaduna, Kaduna" },
        seller: {
          _id: "seller-1",
          slug: "northern-craft",
          storeName: "Northern Craft",
          location: { label: "Kaduna" },
        },
      },
      relatedProducts: [],
    });
    vi.mocked(initializeMarketplacePayment).mockRejectedValue(
      new Error("Paystack is temporarily unavailable")
    );

    render(
      <MemoryRouter initialEntries={["/marketplace/product/kaduna-laptop-bag"]}>
        <Routes>
          <Route
            path="/marketplace/product/:idOrSlug"
            element={<MarketplaceProductDetailsPage />}
          />
        </Routes>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole("button", { name: "Buy now" }));

    await waitFor(() => {
      expect(initializeMarketplacePayment).toHaveBeenCalledWith(
        expect.objectContaining({
          productId: "product-1",
          quantity: 1,
          deliveryMethod: "pickup",
        })
      );
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Paystack is temporarily unavailable"
      );
    });
    expect(toastError).toHaveBeenCalledWith("Paystack is temporarily unavailable");
  });
});

