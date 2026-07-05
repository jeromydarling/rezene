import { Route, Routes, Link } from "react-router";
import { PublicLayout } from "./layouts/PublicLayout";
import { HomePage } from "./pages/public/HomePage";
import { MarkdownPage } from "./pages/public/MarkdownPage";
import { CollectionsPage, CollectionDetailPage } from "./pages/public/CollectionsPage";
import { ProductsPage } from "./pages/public/ProductsPage";
import { ProductDetailPage } from "./pages/public/ProductDetailPage";
import { LookbookPage } from "./pages/public/LookbookPage";
import { JournalPage, JournalPostPage } from "./pages/public/JournalPage";
import { ContactPage } from "./pages/public/ContactPage";

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
    <Routes>
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
        <Route path="stockists" element={<MarkdownPage slug="stockists" eyebrow="Where to find us" />} />
        <Route path="size-guide" element={<MarkdownPage slug="size-guide" eyebrow="Fit" />} />
        <Route
          path="shipping-returns"
          element={<MarkdownPage slug="shipping-returns" eyebrow="Logistics" />}
        />
        <Route path="privacy" element={<MarkdownPage slug="privacy" eyebrow="Legal" />} />
        <Route path="terms" element={<MarkdownPage slug="terms" eyebrow="Legal" />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
