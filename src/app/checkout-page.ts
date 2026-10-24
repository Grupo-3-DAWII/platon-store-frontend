import { CurrencyPipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { Auth } from "./auth";
import { Cart, Catalog, errorMessage, Purchases } from "./store";

@Component({
  imports: [CurrencyPipe, RouterLink],
  template: `
    <a routerLink="/cart" class="back-link">← Volver al carrito</a>
    <div class="section-heading">
      <div>
        <h1>Confirmar pedido</h1>
      </div>
    </div>
    <div class="checkout-grid">
      <section class="panel checkout-details">
        <h2>Datos del cliente</h2>
        <p class="customer-name">
          {{ auth.user()?.name }} {{ auth.user()?.lastname }}
        </p>
        <p class="muted">Usuario: {{ auth.user()?.username }}</p>
        <h2>Libros de tu pedido</h2>
        @for (line of cart.lines(); track line.productId) {
          <div class="review-line">
            <div>
              <strong>{{ line.product?.name || "Libro no disponible" }}</strong>
              <p class="muted">
                {{ line.quantity }}
                {{ line.quantity === 1 ? "unidad" : "unidades" }}
              </p>
            </div>
            <span>{{
              (line.product?.salePrice || 0) * line.quantity
                | currency: "PEN" : "S/ " : "1.2-2"
            }}</span>
          </div>
        } @empty {
          <p>
            Tu carrito está vacío.
            <a routerLink="/" class="text-link">Explorar catálogo</a>
          </p>
        }
      </section>
      <aside class="summary panel">
        <h2>Resumen</h2>
        <div class="summary-line">
          <span>Libros</span><span>{{ cart.count() }}</span>
        </div>
        <div class="summary-total">
          <span>Total</span
          ><strong>{{
            cart.total() | currency: "PEN" : "S/ " : "1.2-2"
          }}</strong>
        </div>
        @if (error()) {
          <p role="alert" class="error-banner">{{ error() }}</p>
          <button class="text-button" (click)="catalog.refresh()">
            Actualizar disponibilidad
          </button>
        }
        @if (catalog.loading()) {
          <p role="status" class="muted">Validando disponibilidad...</p>
        }
        @if (!cart.valid() && !catalog.loading()) {
          <p class="field-error">Revisa tu carrito antes de confirmar.</p>
        }
        <button
          type="button"
          class="btn w-full"
          [disabled]="busy() || !cart.valid()"
          (click)="submit()"
        >
          {{ busy() ? "Creando pedido..." : "Continuar al pago" }}
        </button>
      </aside>
    </div>
  `,
})
export class CheckoutPage {
  readonly auth = inject(Auth);
  readonly cart = inject(Cart);
  readonly catalog = inject(Catalog);
  private readonly purchases = inject(Purchases);
  private readonly router = inject(Router);
  readonly busy = signal(false);
  readonly error = signal("");
  constructor() {
    this.catalog.refresh();
  }
  submit(): void {
    if (this.busy() || !this.cart.valid()) return;
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(["/login"], {
        queryParams: { returnUrl: "/checkout" },
      });
      return;
    }
    this.busy.set(true);
    this.error.set("");
    this.purchases
      .create(this.cart.entries(), this.cart.total())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: ({ idProductsSold }) => {
          this.cart.clear();
          this.cart.notice.set("Tu pedido se creó correctamente.");
          this.catalog.refresh();
          void this.router.navigate(["/payment", idProductsSold], {
            replaceUrl: true,
          });
        },
        error: (error) => {
          this.error.set(errorMessage(error, "No se pudo crear el pedido."));
          this.catalog.refresh();
        },
      });
  }
}
