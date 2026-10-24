import { computed, inject, Injectable, signal } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpParams,
} from "@angular/common/http";
import {
  EMPTY,
  expand,
  finalize,
  map,
  reduce,
  switchMap,
  throwError,
} from "rxjs";
import { Auth } from "./auth";
import { CartEntry, money, Order, Page, Product } from "./models";

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0 || error.status >= 500)
      return "No se pudo conectar con la librería. Inténtalo nuevamente.";
    if (error.status === 401) return "Tu sesión venció. Vuelve a ingresar.";
    if (error.status === 409 || error.status === 400)
      return typeof error.error?.message === "string"
        ? error.error.message
        : typeof error.error?.detail === "string"
          ? error.error.detail
          : fallback;
    if (error.status === 404) return "El registro ya no está disponible.";
    if (error.status === 403) return "No tienes acceso a esta operación.";
  }
  return error instanceof Error ? error.message : fallback;
}

@Injectable({ providedIn: "root" })
export class Catalog {
  private readonly http = inject(HttpClient);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);
  readonly error = signal("");
  constructor() {
    this.refresh();
  }
  refresh(): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.error.set("");
    const page = (index: number) =>
      this.http.get<Page<Product>>("/api/products/catalog", {
        params: new HttpParams().set("page", index).set("size", 100),
      });
    page(0)
      .pipe(
        expand((p) =>
          p.last || p.page + 1 >= p.totalPages ? EMPTY : page(p.page + 1),
        ),
        reduce((all, p) => all.concat(p.content), [] as Product[]),
        finalize(() => this.loading.set(false)),
      )
      .subscribe({
        next: (products) => this.products.set(products.filter((p) => p.active)),
        error: (error) =>
          this.error.set(errorMessage(error, "No se pudo cargar el catálogo.")),
      });
  }
}

@Injectable({ providedIn: "root" })
export class Cart {
  private readonly catalog = inject(Catalog);
  private readonly key = "platon-store-cart";
  readonly entries = signal<CartEntry[]>(this.restore());
  readonly notice = signal("");
  readonly lines = computed(() =>
    this.entries().map((entry) => ({
      ...entry,
      product: this.catalog
        .products()
        .find((p) => p.idProduct === entry.productId),
    })),
  );
  readonly count = computed(() =>
    this.entries().reduce((sum, entry) => sum + entry.quantity, 0),
  );
  readonly total = computed(() =>
    money(
      this.lines().reduce(
        (sum, line) => sum + (line.product?.salePrice ?? 0) * line.quantity,
        0,
      ),
    ),
  );
  readonly valid = computed(
    () =>
      !this.catalog.loading() &&
      !this.catalog.error() &&
      this.lines().length > 0 &&
      this.lines().every(
        (line) =>
          line.product?.active &&
          line.product.available &&
          line.quantity <= line.product.stock,
      ),
  );

  add(product: Product): void {
    const quantity =
      (this.entries().find((entry) => entry.productId === product.idProduct)
        ?.quantity ?? 0) + 1;
    if (!product.active || !product.available || quantity > product.stock) {
      this.notice.set("No hay más unidades disponibles de este libro.");
      return;
    }
    this.setQuantity(product.idProduct, quantity);
    this.notice.set(`${product.name} se agregó al carrito.`);
  }
  setQuantity(productId: number, value: number): void {
    if (!Number.isSafeInteger(value) || value < 1) return;
    const product = this.catalog
      .products()
      .find((p) => p.idProduct === productId);
    if (!product || value > product.stock) {
      this.notice.set("La cantidad supera el stock disponible.");
      return;
    }
    const entries = this.entries().filter(
      (entry) => entry.productId !== productId,
    );
    this.save([...entries, { productId, quantity: value }]);
  }
  remove(productId: number): void {
    this.save(this.entries().filter((entry) => entry.productId !== productId));
  }
  clear(): void {
    this.save([]);
  }
  private save(entries: CartEntry[]): void {
    this.entries.set(entries);
    localStorage.setItem(this.key, JSON.stringify(entries));
  }
  private restore(): CartEntry[] {
    try {
      const raw: unknown = JSON.parse(localStorage.getItem(this.key) ?? "[]");
      if (!Array.isArray(raw)) return [];
      const seen = new Set<number>();
      return raw
        .filter((entry): entry is CartEntry => {
          if (
            !entry ||
            !Number.isSafeInteger(entry.productId) ||
            entry.productId < 1 ||
            !Number.isSafeInteger(entry.quantity) ||
            entry.quantity < 1 ||
            entry.quantity > 999 ||
            seen.has(entry.productId)
          )
            return false;
          seen.add(entry.productId);
          return true;
        })
        .map(({ productId, quantity }) => ({ productId, quantity }));
    } catch {
      return [];
    }
  }
}

@Injectable({ providedIn: "root" })
export class Purchases {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);
  create(entries: CartEntry[], total: number) {
    const user = this.auth.user();
    if (!this.auth.isAuthenticated() || !user)
      return throwError(
        () => new Error("Inicia sesión para confirmar el pedido."),
      );
    return this.http
      .get<{ idStateSold: number; nameState: string }[]>("/api/states-sold")
      .pipe(
        map((states) => {
          const pending = states.find(
            (state) => state.nameState.toUpperCase() === "PENDIENTE",
          );
          if (!pending)
            throw new Error(
              "No se pudo preparar el pedido. Inténtalo nuevamente.",
            );
          return {
            idUser: user.idUser,
            idStateSold: pending.idStateSold,
            totalAmount: total,
            products: entries.map((entry) => ({
              idProducts: entry.productId,
              numberSold: entry.quantity,
            })),
          };
        }),
        switchMap((request) =>
          this.http.post<{ idProductsSold: number }>(
            "/api/products-sold",
            request,
          ),
        ),
      );
  }
  get(id: number) {
    return this.http.get<Order>(`/api/products-sold/${id}`).pipe(
      map((order) => {
        if (order.idUser !== this.auth.user()?.idUser)
          throw new Error("Pedido no encontrado.");
        return order;
      }),
    );
  }
  pay(id: number, amount: number) {
    return this.http.post(`/api/products-sold/${id}/payment/simulate-card`, {
      amount,
      testToken: "visa-platinum-test",
    });
  }
  list() {
    const id = this.auth.user()?.idUser;
    if (!this.auth.isAuthenticated() || !id)
      return throwError(
        () => new Error("Inicia sesión para consultar tus pedidos."),
      );
    const page = (index: number) =>
      this.http.get<Page<Order>>("/api/products-sold", {
        params: new HttpParams()
          .set("idUser", id)
          .set("page", index)
          .set("size", 100),
      });
    return page(0).pipe(
      expand((p) =>
        p.last || p.page + 1 >= p.totalPages ? EMPTY : page(p.page + 1),
      ),
      reduce((all, p) => all.concat(p.content), [] as Order[]),
      map((orders) => orders.filter((order) => order.idUser === id)),
    );
  }
}
