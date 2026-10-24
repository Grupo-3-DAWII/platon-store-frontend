import { CurrencyPipe } from "@angular/common";
import { Component, computed, inject, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { Catalog, Cart } from "./store";
import { COVER } from "./models";

const normalized = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

@Component({
  imports: [CurrencyPipe, RouterLink],
  template: `
    <section id="catalog">
      <div class="section-heading">
        <div>
          <h1>Catálogo</h1>
          <p class="muted">Libros disponibles en la librería.</p>
        </div>
        <p class="muted">
          {{ filtered().length }}
          {{ filtered().length === 1 ? "libro" : "libros" }}
        </p>
      </div>
      <div class="catalog-toolbar">
        <label class="search-field"
          ><img
            src="/icons/hicon/search.svg"
            width="20"
            height="20"
            alt="" /><input
            type="search"
            aria-label="Buscar libros por título o autor"
            placeholder="Buscar por título o autor"
            [value]="search()"
            (input)="search.set(value($event)); page.set(1)"
        /></label>
        <label class="sr-only" for="genre">Categoría</label
        ><select
          id="genre"
          [value]="genre()"
          (change)="genre.set(value($event)); page.set(1)"
        >
          <option value="">Todas las categorías</option>
          @for (item of genres(); track item) {
            <option [value]="item">{{ item }}</option>
          }
        </select>
        <label class="sr-only" for="sort">Ordenar libros</label
        ><select
          id="sort"
          [value]="sort()"
          (change)="sort.set(value($event)); page.set(1)"
        >
          <option value="title">Título A–Z</option>
          <option value="price-asc">Menor precio</option>
          <option value="price-desc">Mayor precio</option>
        </select>
      </div>
      @if (catalog.loading()) {
        <div class="empty" role="status">Cargando libros...</div>
      } @else if (catalog.error()) {
        <div class="empty" role="alert">
          <p>{{ catalog.error() }}</p>
          <button class="btn btn-outline" (click)="catalog.refresh()">
            Reintentar
          </button>
        </div>
      } @else {
        <div class="book-grid">
          @for (book of displayed(); track book.idProduct) {
            <article class="book-card">
              <div class="book-title">
                <h3>
                  <a [routerLink]="['/books', book.idProduct]">{{
                    book.name
                  }}</a>
                </h3>
                <p>{{ book.author }}</p>
              </div>
              <div
                class="book-stock"
                [class.sold-out]="!book.available || book.stock <= 0"
              >
                {{
                  book.available && book.stock > 0 ? "Disponible" : "Agotado"
                }}
              </div>
              <a
                class="cover-wrap"
                [routerLink]="['/books', book.idProduct]"
                [attr.aria-label]="'Ver ' + book.name"
                ><img
                  [src]="book.image || cover"
                  [alt]="'Portada de ' + book.name"
                  loading="lazy"
                  (error)="imageError($event)"
              /></a>
              <div class="book-meta">
                <span class="pill">{{ book.genre }}</span
                ><strong>{{
                  book.salePrice | currency: "PEN" : "S/ " : "1.2-2"
                }}</strong>
              </div>

              <button
                class="btn btn-outline w-full"
                [disabled]="!book.available || book.stock <= 0"
                (click)="cart.add(book)"
                [attr.aria-label]="'Agregar ' + book.name + ' al carrito'"
              >
                Agregar al carrito <span aria-hidden="true">+</span>
              </button>
            </article>
          } @empty {
            <div class="empty full-width">
              <h3>No encontramos libros</h3>
              <p>Prueba otro título, autor o categoría.</p>
              <button
                class="btn btn-outline"
                (click)="search.set(''); genre.set('')"
              >
                Limpiar búsqueda
              </button>
            </div>
          }
        </div>
        @if (filtered().length > pageSize) {
          <nav class="pagination" aria-label="Paginación del catálogo">
            <button
              class="btn btn-outline"
              [disabled]="page() === 1"
              (click)="page.set(page() - 1)"
            >
              Anterior</button
            ><span>Página {{ page() }} de {{ pages() }}</span
            ><button
              class="btn btn-outline"
              [disabled]="page() >= pages()"
              (click)="page.set(page() + 1)"
            >
              Siguiente
            </button>
          </nav>
        }
      }
    </section>
  `,
})
export class CatalogPage {
  constructor() {
    this.catalog.refresh();
  }
  readonly catalog = inject(Catalog);
  readonly cart = inject(Cart);
  readonly cover = COVER;
  readonly search = signal("");
  readonly genre = signal("");
  readonly sort = signal("title");
  readonly page = signal(1);
  readonly pageSize = 12;
  readonly genres = computed(() =>
    [...new Set(this.catalog.products().map((p) => p.genre))]
      .filter(Boolean)
      .sort(),
  );
  readonly filtered = computed(() => {
    const term = normalized(this.search());
    return this.catalog
      .products()
      .filter(
        (p) =>
          (!term || normalized(p.name + " " + p.author).includes(term)) &&
          (!this.genre() || p.genre === this.genre()),
      )
      .sort((a, b) =>
        this.sort() === "price-asc"
          ? a.salePrice - b.salePrice
          : this.sort() === "price-desc"
            ? b.salePrice - a.salePrice
            : a.name.localeCompare(b.name),
      );
  });
  readonly pages = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize)),
  );
  readonly displayed = computed(() =>
    this.filtered().slice(
      (this.page() - 1) * this.pageSize,
      this.page() * this.pageSize,
    ),
  );
  value(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }
  imageError(event: Event): void {
    (event.target as HTMLImageElement).src = COVER;
  }
}
