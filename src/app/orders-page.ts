import { CurrencyPipe, DatePipe } from "@angular/common";
import { Component, DestroyRef, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { finalize, timer } from "rxjs";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { Purchases, errorMessage } from "./store";
import { Order, statusLabel } from "./models";

@Component({
  imports: [CurrencyPipe, DatePipe, RouterLink],
  template: `
    <div class="section-heading">
      <div>
        <h1>Mis pedidos</h1>
        <p class="muted">Consulta tus libros y el estado de cada pedido.</p>
      </div>
      <button
        type="button"
        class="btn btn-outline"
        [disabled]="loading()"
        (click)="load()"
      >
        Actualizar
      </button>
    </div>
    @if (loading()) {
      <p class="empty" role="status">Cargando pedidos...</p>
    } @else if (error()) {
      <div class="empty" role="alert">
        <p>{{ error() }}</p>
        <button class="btn" (click)="load()">Reintentar</button>
      </div>
    } @else {
      <div class="order-list">
        @for (order of orders(); track order.idProductsSold) {
          <article class="panel order-card">
            <div class="order-heading">
              <div>
                <h2>Pedido #{{ order.idProductsSold }}</h2>
                <p class="muted text-sm">
                  {{ order.createDate | date: "dd/MM/yyyy, HH:mm" }}
                </p>
              </div>
              <span
                class="pill"
                [class.pill-paid]="order.orderStatus === 'ENTREGADO'"
                [class.pill-cancelled]="order.orderStatus === 'CANCELADO'"
                >{{ deliveryLabel(order) }}</span
              >
            </div>
            @if (order.stateSold.nameState === "PAGADO") {
              <p class="text-sm pill-paid">Pagado</p>
            }
            @if (order.paymentMethod === "VISA_PLATINUM_SIMULATED") {
              <p class="muted text-sm">Tarjeta · Visa</p>
            }
            @if (
              order.stateSold.nameState === "PENDIENTE" &&
              order.totalAmount !== null
            ) {
              <a
                class="btn btn-small"
                [routerLink]="['/payment', order.idProductsSold]"
                >Pagar pedido</a
              >
            }
            <details>
              <summary>
                Ver detalle
                <span
                  >{{ order.products.length }}
                  {{ order.products.length === 1 ? "título" : "títulos" }}</span
                >
              </summary>
              @for (item of order.products; track item.idProducts) {
                <div class="review-line">
                  <div>
                    <strong>{{
                      item.product?.name || "Producto #" + item.idProducts
                    }}</strong>
                    <p class="muted text-sm">
                      Cantidad: {{ item.numberSold }} · Precio:
                      {{
                        item.unitPrice === null
                          ? "—"
                          : (item.unitPrice | currency: "PEN" : "S/ " : "1.2-2")
                      }}
                    </p>
                  </div>
                  <span>{{
                    item.subtotal === null
                      ? "—"
                      : (item.subtotal | currency: "PEN" : "S/ " : "1.2-2")
                  }}</span>
                </div>
              }
            </details>
            <div class="order-total">
              <span>Total del pedido</span
              ><strong>{{
                order.totalAmount === null
                  ? "—"
                  : (order.totalAmount | currency: "PEN" : "S/ " : "1.2-2")
              }}</strong>
            </div>
          </article>
        } @empty {
          <div class="empty panel">
            <h2>Aún no tienes pedidos</h2>
            <p>Los pedidos que realices aparecerán aquí.</p>
            <a routerLink="/" class="btn">Explorar libros</a>
          </div>
        }
      </div>
    }
  `,
})
export class OrdersPage {
  private readonly purchases = inject(Purchases);
  readonly orders = signal<Order[]>([]);
  readonly loading = signal(false);
  readonly error = signal("");
  readonly label = statusLabel;
  deliveryLabel(order: Order): string {
    const state =
      order.orderStatus ??
      (order.stateSold.nameState === "CANCELADO" ? "CANCELADO" : "PENDIENTE");
    return (
      (
        {
          PENDIENTE: "Pendiente",
          PREPARANDO: "Preparando",
          EN_CAMINO: "En camino",
          ENTREGADO: "Entregado",
          CANCELADO: "Cancelado",
        } as Record<string, string>
      )[state] ?? state
    );
  }
  constructor() {
    this.load();
    timer(8000, 8000)
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe(() => this.load(true));
  }
  private refreshing = false;
  load(silent = false): void {
    if (this.refreshing) return;
    this.refreshing = true;
    if (!silent) this.loading.set(true);
    this.error.set("");
    this.purchases
      .list()
      .pipe(
        finalize(() => {
          this.refreshing = false;
          this.loading.set(false);
        }),
      )
      .subscribe({
        next: (orders) => this.orders.set(orders),
        error: (error) =>
          this.error.set(
            errorMessage(error, "No se pudieron cargar tus pedidos."),
          ),
      });
  }
}
