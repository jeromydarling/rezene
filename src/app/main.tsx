import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { AppRouter } from "./router";
import { VertoApp } from "./verto/VertoApp";
import { getShop } from "./lib/shop";
import "./styles/global.css";

// The edge injects window.__VERTO__: a shop context on /<slug> (or a
// CNAME'd shop domain) boots the shop app under that base path; the
// platform root boots Verto's marketing site.
const shop = getShop();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {shop ? (
      <BrowserRouter basename={shop.basePath}>
        <AppRouter />
      </BrowserRouter>
    ) : (
      <BrowserRouter>
        <VertoApp />
      </BrowserRouter>
    )}
  </StrictMode>,
);
