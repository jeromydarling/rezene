import { Route, Routes, Link, useParams } from "react-router";
import { AuthProvider } from "./lib/auth";
import { CartProvider } from "./lib/cart";
import { BrandProvider } from "./lib/brand";
import { PublicLayout } from "./layouts/PublicLayout";
import { AdminLayout } from "./layouts/AdminLayout";
import { HomePage } from "./pages/public/HomePage";
import { MarkdownPage } from "./pages/public/MarkdownPage";
import { CollectionsPage, CollectionDetailPage } from "./pages/public/CollectionsPage";
import { ProductsPage } from "./pages/public/ProductsPage";
import { ProductDetailPage } from "./pages/public/ProductDetailPage";
import { LookbookPage } from "./pages/public/LookbookPage";
import { JournalPage, JournalPostPage } from "./pages/public/JournalPage";
import { ContactPage } from "./pages/public/ContactPage";
import { CheckoutSuccessPage } from "./pages/public/CheckoutSuccessPage";
import { CartPage } from "./pages/public/CartPage";
import { FactoryPortalPage } from "./pages/public/FactoryPortalPage";
import { LoginPage } from "./pages/auth/LoginPage";
import { DashboardPage } from "./pages/admin/DashboardPage";
import { StylesPage, SkusPage } from "./pages/admin/StylesPage";
import { ProductsAdminPage, CollectionsAdminPage } from "./pages/admin/ProductsAdminPage";
import { InventoryPage } from "./pages/admin/InventoryPage";
import { OrdersPage, CustomersPage, PreOrdersPage } from "./pages/admin/CommercePages";
import { ProductionPage } from "./pages/admin/ProductionPage";
import { SuppliersPage } from "./pages/admin/SuppliersPage";
import { SamplesPage, PurchaseOrdersPage, MaterialsPage } from "./pages/admin/SamplesPage";
import { TechPacksPage, TechPackDetailPage } from "./pages/admin/TechPacksPage";
import { TechPackAiPage } from "./pages/admin/TechPackAiPage";
import { AiConceptsPage, ThreeDPage, FilesPage } from "./pages/admin/StudioPages";
import { CostingPage, DutiesPage, AnalyticsPage, SettingsPage } from "./pages/admin/FinancePages";
import {
  PagesEditorPage,
  JournalEditorPage,
  LookbooksEditorPage,
} from "./pages/admin/ContentPages";

/** CMS-created pages published at /p/:slug. */
function DynamicPage() {
  const { slug } = useParams();
  return <MarkdownPage slug={slug ?? ""} />;
}

function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-5 py-32 text-center">
      <p className="eyebrow mb-4">404</p>
      <h1 className="display-hero text-4xl">Off the map</h1>
      <p className="prose-editorial mt-4">
        This page drifted out with the tide. Head back to shore.
      </p>
      <Link to="/" className="btn btn-secondary mt-8">
        Home
      </Link>
    </div>
  );
}

export function AppRouter() {
  return (
    <BrandProvider>
      <AuthProvider>
        <CartProvider>
        <Routes>
        {/* Public site */}
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="story" element={<MarkdownPage slug="story" eyebrow="Our story" />} />
          <Route path="collections" element={<CollectionsPage />} />
          <Route path="collections/:slug" element={<CollectionDetailPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/:slug" element={<ProductDetailPage />} />
          <Route path="lookbook" element={<LookbookPage />} />
          <Route path="atelier" element={<MarkdownPage slug="atelier" eyebrow="Casablanca" />} />
          <Route path="journal" element={<JournalPage />} />
          <Route path="journal/:slug" element={<JournalPostPage />} />
          <Route
            path="stockists"
            element={<MarkdownPage slug="stockists" eyebrow="Where to find us" />}
          />
          <Route path="size-guide" element={<MarkdownPage slug="size-guide" eyebrow="Fit" />} />
          <Route
            path="shipping-returns"
            element={<MarkdownPage slug="shipping-returns" eyebrow="Logistics" />}
          />
          <Route path="privacy" element={<MarkdownPage slug="privacy" eyebrow="Legal" />} />
          <Route path="terms" element={<MarkdownPage slug="terms" eyebrow="Legal" />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="cart" element={<CartPage />} />
          <Route path="checkout/success" element={<CheckoutSuccessPage />} />
          <Route path="p/:slug" element={<DynamicPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Factory portal — tokenized, outside the public site chrome */}
        <Route path="factory/:token" element={<FactoryPortalPage />} />

        {/* Auth */}
        <Route path="admin/login" element={<LoginPage />} />

        {/* Admin OS */}
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<ProductsAdminPage />} />
          <Route path="styles" element={<StylesPage />} />
          <Route path="skus" element={<SkusPage />} />
          <Route path="collections" element={<CollectionsAdminPage />} />
          <Route path="inventory" element={<InventoryPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="customers" element={<CustomersPage />} />
          <Route path="pre-orders" element={<PreOrdersPage />} />
          <Route path="production" element={<ProductionPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="materials" element={<MaterialsPage />} />
          <Route path="samples" element={<SamplesPage />} />
          <Route path="purchase-orders" element={<PurchaseOrdersPage />} />
          <Route path="tech-packs" element={<TechPacksPage />} />
          <Route path="tech-packs/:id" element={<TechPackDetailPage />} />
          <Route path="tech-packs/:id/ai-assist" element={<TechPackAiPage />} />
          <Route path="ai-concepts" element={<AiConceptsPage />} />
          <Route path="3d" element={<ThreeDPage />} />
          <Route path="files" element={<FilesPage />} />
          <Route path="costing" element={<CostingPage />} />
          <Route path="duties" element={<DutiesPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="content/pages" element={<PagesEditorPage />} />
          <Route path="content/journal" element={<JournalEditorPage />} />
          <Route path="content/lookbooks" element={<LookbooksEditorPage />} />
        </Route>
        </Routes>
        </CartProvider>
      </AuthProvider>
    </BrandProvider>
  );
}
