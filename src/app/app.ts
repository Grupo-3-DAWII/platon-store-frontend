import { ConfirmDialog, ConfirmationService } from "./confirm-dialog";
import { Component, computed, inject, signal } from "@angular/core";
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from "@angular/router";
import { Auth } from "./auth";
import { Cart } from "./store";

@Component({
  selector: "app-root",
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ConfirmDialog],
  template: `
    <a class="skip-link" href="#main">Ir al contenido</a>
    <header class="store-header">
      <div class="shell header-inner">
        <a routerLink="/" aria-label="Platón, inicio"
          ><img
            class="logo"
            src="/images/logo/platon-logotipo.png"
            alt="Librería Platón"
        /></a>
        <nav aria-label="Navegación principal">
          <a
            routerLink="/"
            routerLinkActive="nav-active"
            [routerLinkActiveOptions]="{ exact: true }"
            >Catálogo</a
          >
          @if (auth.isAuthenticated()) {
            <a routerLink="/orders" routerLinkActive="nav-active"
              >Mis pedidos</a
            >
          }
        </nav>
        <div class="header-actions">
          <a
            routerLink="/cart"
            class="cart-link"
            [attr.aria-label]="
              'Carrito, ' +
              cart.count() +
              (cart.count() === 1 ? ' libro' : ' libros')
            "
            ><img
              src="/icons/hicon/orders.svg"
              alt=""
              width="20"
              height="20"
            /><span>Carrito</span
            ><span class="cart-count">{{ cart.count() }}</span></a
          >
          @if (auth.isAuthenticated()) {
            <div
              class="profile-menu"
              tabindex="-1"
              (keydown.escape)="profileOpen.set(false)"
            >
              <button
                type="button"
                class="profile-trigger"
                (click)="profileOpen.set(!profileOpen())"
                aria-controls="profile-options"
                [attr.aria-expanded]="profileOpen()"
                aria-label="Abrir menú de perfil"
              >
                <img
                  src="/images/avatar/user-avatar.png"
                  alt=""
                  class="profile-avatar"
                />
                <span class="profile-caption"
                  ><strong>{{ profileName() }}</strong></span
                >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="m6 9 6 6 6-6"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              @if (profileOpen()) {
                <button
                  type="button"
                  class="menu-backdrop"
                  tabindex="-1"
                  aria-label="Cerrar menú"
                  (click)="profileOpen.set(false)"
                ></button>
                <div id="profile-options" class="profile-options">
                  <a routerLink="/profile" (click)="profileOpen.set(false)"
                    >Mi perfil</a
                  >
                  <a routerLink="/orders" (click)="profileOpen.set(false)"
                    >Mis pedidos</a
                  >
                  <button type="button" (click)="logout()">
                    Cerrar sesión
                  </button>
                </div>
              }
            </div>
          } @else {
            <a class="account-link" routerLink="/login">Ingresar</a>
            <a class="btn btn-small" routerLink="/register">Crear cuenta</a>
          }
        </div>
      </div>
    </header>
    <main id="main" class="shell main-content"><router-outlet /></main>
    @if (cart.notice()) {
      <div class="toast" role="status">
        <span>{{ cart.notice() }}</span
        ><button
          type="button"
          aria-label="Cerrar aviso"
          (click)="cart.notice.set('')"
        >
          ×
        </button>
      </div>
    }
    <app-confirm-dialog />
    <footer class="store-footer">
      <div class="shell footer-inner">
        <img
          src="/images/logo/platon-logotipo.png"
          alt="Librería Platón"
          width="88"
        />
        <p>Librería Platón</p>
      </div>
    </footer>
  `,
})
export class App {
  readonly auth = inject(Auth);
  readonly profileName = computed(() => {
    const user = this.auth.user();
    return [user?.name, user?.lastname]
      .map((value) => value?.trim().split(/\s+/)[0])
      .filter(Boolean)
      .join(" ");
  });
  readonly cart = inject(Cart);
  private readonly router = inject(Router);
  readonly profileOpen = signal(false);
  private readonly confirmation = inject(ConfirmationService);
  async logout(): Promise<void> {
    if (
      !(await this.confirmation.ask(
        "Cerrar sesión",
        "Tu carrito se conservará para cuando vuelvas a ingresar.",
        "Cerrar sesión",
      ))
    )
      return;
    this.profileOpen.set(false);
    this.auth.logout();
    void this.router.navigate(["/"]);
  }
}
