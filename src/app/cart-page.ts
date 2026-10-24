import { CurrencyPipe } from "@angular/common";
import { Component, inject } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Cart, Catalog } from "./store";
import { COVER } from "./models";

@Component({
  imports: [CurrencyPipe, RouterLink],
  template: `
    <a routerLink="/" class="back-link">← Seguir explorando</a>
    <div class="section-heading">
      <div>
        <h1>Mi carrito</h1>
      </div>
      <p class="muted">
        {{ cart.count() }} {{ cart.count() === 1 ? "unidad" : "unidades" }}
      </p>
    </div>
    @if (catalog.loading()) {
      <p class="empty" role="status">Actualizando disponibilidad...</p>
    } @else if (catalog.error()) {
      <div class="empty" role="alert">
        <p>{{ catalog.error() }}</p>
        <button class="btn" (click)="catalog.refresh()">Reintentar</button>
      </div>
    } @else if (!cart.entries().length) {
      <div class="empty panel">
        <img src="/icons/hicon/orders.svg" width="44" height="44" alt="" />
        <h2>Tu carrito está vacío</h2>
        <p>Agrega un libro del catálogo para empezar tu pedido.</p>
        <a routerLink="/" class="btn">Explorar libros</a>
      </div>
    } @else {
      <div class="checkout-grid">
        <div class="cart-list">
          @for (line of cart.lines(); track line.productId) {
            <article class="cart-row panel">
              <img
                class="cart-cover"
                [src]="line.product?.image || cover"
                [alt]="line.product?.name || 'Libro no disponible'"
                (error)="imageError($event)"
              />
              <div class="cart-info">
                <h2>
                  <a [routerLink]="['/books', line.productId]">{{
                    line.product?.name || "Libro no disponible"
                  }}</a>
                </h2>
                <p class="muted">{{ line.product?.author }}</p>
                @if (line.product; as book) {
                  <p class="unit-price">
                    {{ book.salePrice | currency: "PEN" : "S/ " : "1.2-2" }} por
                    unidad
                  </p>
                }
                @if (
                  !line.product?.available ||
                  line.quantity > (line.product?.stock || 0)
                ) {
                  <p class="field-error">
                    Revisa la disponibilidad o retira este libro.
                  </p>
                }
                <label class="quantity-label"
                  >Cantidad<input
                    type="number"
                    min="1"
                    [max]="line.product?.stock || 1"
                    [value]="line.quantity"
                    [attr.aria-label]="
                      'Cantidad de ' + (line.product?.name || 'libro')
                    "
                    (change)="quantity(line.productId, $event)" /></label
                ><button
                  type="button"
                  class="text-button"
                  (click)="cart.remove(line.productId)"
                  [attr.aria-label]="
                    'Quitar ' + (line.product?.name || 'libro')
                  "
                >
                  Quitar
                </button>
              </div>
              <strong class="line-price">{{
                (line.product ? line.product.salePrice * line.quantity : 0)
                  | currency: "PEN" : "S/ " : "1.2-2"
              }}</strong>
            </article>
          }
        </div>
        <aside class="summary panel">
          <h2>Resumen del pedido</h2>
          <div class="summary-line">
            <span>Libros</span><span>{{ cart.count() }}</span>
          </div>
          <div class="summary-total">
            <span>Total</span
            ><strong>{{
              cart.total() | currency: "PEN" : "S/ " : "1.2-2"
            }}</strong>
          </div>
          <p class="muted text-sm">
            La disponibilidad y los precios se validarán al confirmar.
          </p>
          @if (cart.valid()) {
            <a routerLink="/checkout" class="btn w-full"
              >Continuar con el pedido →</a
            >
          } @else {
            <p role="alert" class="field-error">
              Revisa los libros del carrito antes de continuar.
            </p>
          }
          <p class="text-xs muted"></p>
        </aside>
      </div>
    }
  `,
})
export class CartPage {
  readonly cart = inject(Cart);
  readonly catalog = inject(Catalog);
  readonly cover = COVER;
  constructor() {
    this.catalog.refresh();
  }
  quantity(id: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    this.cart.setQuantity(id, Number(input.value));
    input.value = String(
      this.cart.entries().find((entry) => entry.productId === id)?.quantity ??
        1,
    );
  }
  imageError(event: Event): void {
    (event.target as HTMLImageElement).src = COVER;
  }
}
