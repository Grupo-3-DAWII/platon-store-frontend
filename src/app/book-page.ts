import { CurrencyPipe } from "@angular/common";
import { Component, computed, inject } from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { map } from "rxjs";
import { Catalog, Cart } from "./store";
import { COVER } from "./models";

@Component({
  imports: [CurrencyPipe, RouterLink],
  template: `
    <a routerLink="/" class="back-link">← Volver al catálogo</a>
    @if (state().loading) {
      <p class="empty" role="status">Cargando libro...</p>
    } @else if (state().error) {
      <div class="empty" role="alert">
        <h1>Libro no disponible</h1>
        <p>{{ state().error }}</p>
        <a routerLink="/" class="btn">Ver catálogo</a>
      </div>
    } @else if (state().book; as book) {
      <article class="book-detail panel">
        <div class="detail-cover">
          <img
            [src]="book.image || cover"
            [alt]="'Portada de ' + book.name"
            (error)="imageError($event)"
          />
        </div>
        <div class="detail-content">
          <span class="pill">{{ book.genre }}</span>
          <h1>{{ book.name }}</h1>
          <p class="detail-author">{{ book.author }}</p>
          <p class="detail-description">
            {{
              book.description ||
                "Consulta los datos de este título y agrégalo a tu pedido."
            }}
          </p>
          <dl class="book-facts">
            <div>
              <dt>Editorial</dt>
              <dd>{{ book.editorial }}</dd>
            </div>
            <div>
              <dt>ISBN</dt>
              <dd>{{ book.isbn || "—" }}</dd>
            </div>
            <div>
              <dt>Publicación</dt>
              <dd>{{ book.publicationYear || "—" }}</dd>
            </div>
          </dl>
          <strong class="detail-price">{{
            book.salePrice | currency: "PEN" : "S/ " : "1.2-2"
          }}</strong>
          <p class="muted">
            {{
              book.available && book.stock > 0
                ? book.stock + " unidades disponibles"
                : "Agotado"
            }}
          </p>
          <div class="detail-buttons">
            <button
              class="btn"
              [disabled]="!book.available || book.stock <= 0"
              (click)="cart.add(book)"
            >
              Agregar al carrito</button
            ><a class="btn btn-outline" routerLink="/cart">Ver carrito</a>
          </div>
        </div>
      </article>
    }
  `,
})
export class BookPage {
  constructor() {
    this.catalog.refresh();
  }
  private readonly catalog = inject(Catalog);
  readonly cart = inject(Cart);
  readonly cover = COVER;
  private readonly id = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => Number(params.get("id"))),
    ),
    { initialValue: 0 },
  );
  readonly state = computed(() => {
    const id = this.id();
    const book =
      this.catalog.products().find((item) => item.idProduct === id) ?? null;
    return {
      book,
      loading: this.catalog.loading(),
      error:
        this.catalog.error() ||
        (!this.catalog.loading() && !book
          ? "Este título no está disponible."
          : ""),
    };
  });
  imageError(event: Event): void {
    (event.target as HTMLImageElement).src = COVER;
  }
}
