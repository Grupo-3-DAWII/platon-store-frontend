import { Routes } from "@angular/router";
import { customerGuard } from "./auth";

export const routes: Routes = [
  {
    path: "profile",
    canActivate: [customerGuard],
    loadComponent: () => import("./profile-page").then((m) => m.ProfilePage),
    title: "Mi perfil | Platón",
  },
  {
    path: "payment/:id",
    canActivate: [customerGuard],
    loadComponent: () => import("./payment-page").then((m) => m.PaymentPage),
    title: "Pago | Platón",
  },
  {
    path: "register",
    loadComponent: () => import("./register-page").then((m) => m.RegisterPage),
    title: "Crear cuenta | Platón",
  },
  {
    path: "",
    loadComponent: () => import("./catalog-page").then((m) => m.CatalogPage),
    title: "Catálogo | Platón",
  },
  {
    path: "books/:id",
    loadComponent: () => import("./book-page").then((m) => m.BookPage),
    title: "Libro | Platón",
  },
  {
    path: "cart",
    loadComponent: () => import("./cart-page").then((m) => m.CartPage),
    title: "Mi carrito | Platón",
  },
  {
    path: "login",
    loadComponent: () => import("./login-page").then((m) => m.LoginPage),
    title: "Ingresar | Platón",
  },
  {
    path: "checkout",
    canActivate: [customerGuard],
    loadComponent: () => import("./checkout-page").then((m) => m.CheckoutPage),
    title: "Confirmar pedido | Platón",
  },
  {
    path: "orders",
    canActivate: [customerGuard],
    loadComponent: () => import("./orders-page").then((m) => m.OrdersPage),
    title: "Mis pedidos | Platón",
  },
  { path: "**", redirectTo: "" },
];
