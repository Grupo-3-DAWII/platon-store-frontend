import { TestBed } from "@angular/core/testing";
import { signal } from "@angular/core";
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from "@angular/common/http";
import {
  HttpTestingController,
  provideHttpClientTesting,
} from "@angular/common/http/testing";
import { provideRouter, Router } from "@angular/router";
import { Subject } from "rxjs";
import { Auth, customerGuard, sessionInterceptor, tokenClaims } from "./auth";
import { Cart, Catalog, Purchases } from "./store";
import { Product } from "./models";
import { CheckoutPage } from "./checkout-page";

const book: Product = {
  idProduct: 1,
  name: "Don Quijote",
  author: "Cervantes",
  genre: "Literatura",
  editorial: "Editorial",
  image: null,
  salePrice: 25.5,
  stock: 3,
  active: true,
  available: true,
};
const customer = {
  idUser: 2,
  username: "cliente",
  name: "Cliente",
  lastname: "Prueba",
  role: "USER",
  status: "active",
};
const token = (extra = {}) =>
  `header.${btoa(JSON.stringify({ idUser: 2, sub: "cliente", exp: Math.floor(Date.now() / 1000) + 3600, ...extra }))}.signature`;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe("Customer session", () => {
  it("keeps JWT headers on API requests and clears a rejected session", () => {
    const logout = vi.fn();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: Auth,
          useValue: {
            isAuthenticated: () => true,
            session: () => ({ token: "valid-token" }),
            logout,
          },
        },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const client = TestBed.inject(HttpClient);
    const navigate = vi
      .spyOn(TestBed.inject(Router), "navigate")
      .mockResolvedValue(true);
    client.get("/api/products-sold").subscribe({ error: () => undefined });
    const request = http.expectOne("/api/products-sold");
    expect(request.request.headers.get("Authorization")).toBe(
      "Bearer valid-token",
    );
    request.flush({}, { status: 401, statusText: "Unauthorized" });
    expect(logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalled();
    client.get("https://example.test/image").subscribe();
    const external = http.expectOne("https://example.test/image");
    expect(external.request.headers.has("Authorization")).toBe(false);
    external.flush({});
    http.verify();
  });
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    return {
      auth: TestBed.inject(Auth),
      http: TestBed.inject(HttpTestingController),
    };
  }
  it("signs in a customer and obtains their own account using the issued token", () => {
    const { auth, http } = setup();
    const jwt = token();
    auth.login(" cliente ", "secret").subscribe();
    const request = http.expectOne("/api/v1/login");
    expect(request.request.body.username).toBe("cliente");
    request.flush({ access_token: jwt });
    const profile = http.expectOne("/api/accounts/2");
    expect(profile.request.headers.get("Authorization")).toBe(`Bearer ${jwt}`);
    profile.flush(customer);
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.user()?.idUser).toBe(2);
    auth.logout();
    expect(sessionStorage.getItem("platon-store-session")).toBeNull();
    http.verify();
  });
  it("does not admit a staff account as a customer", () => {
    const { auth, http } = setup();
    const error = vi.fn();
    auth.login("cliente", "secret").subscribe({ error });
    http.expectOne("/api/v1/login").flush({ access_token: token() });
    http.expectOne("/api/accounts/2").flush({ ...customer, role: "ADMIN" });
    expect(error).toHaveBeenCalled();
    expect(auth.session()).toBeNull();
    http.verify();
  });
  it("rejects an expired or malformed token and a profile that does not match it", () => {
    expect(() => tokenClaims(token({ exp: 1 }))).toThrow();
    expect(() => tokenClaims("bad")).toThrow();
    const { auth, http } = setup();
    const error = vi.fn();
    auth.login("cliente", "secret").subscribe({ error });
    http.expectOne("/api/v1/login").flush({ access_token: token() });
    http.expectOne("/api/accounts/2").flush({ ...customer, idUser: 9 });
    expect(error).toHaveBeenCalled();
    expect(auth.session()).toBeNull();
    http.verify();
  });
  it("redirects anonymous checkout to login without discarding its destination", () => {
    setup();
    const result = TestBed.runInInjectionContext(() =>
      customerGuard({} as never, { url: "/checkout" } as never),
    );
    expect(
      TestBed.inject(Router).serializeUrl(
        result as ReturnType<Router["createUrlTree"]>,
      ),
    ).toBe("/login?returnUrl=%2Fcheckout");
  });
});

describe("Catalog API", () => {
  it("collects every page and excludes inactive books from the store", () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const catalog = TestBed.inject(Catalog);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne("/api/products/catalog?page=0&size=100")
      .flush({ content: [book], page: 0, totalPages: 2, last: false });
    http.expectOne("/api/products/catalog?page=1&size=100").flush({
      content: [{ ...book, idProduct: 2, active: false }],
      page: 1,
      totalPages: 2,
      last: true,
    });
    expect(catalog.products()).toEqual([book]);
    expect(catalog.loading()).toBe(false);
    http.verify();
  });
  it("shows a service error and can reload the catalog", () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const catalog = TestBed.inject(Catalog);
    const http = TestBed.inject(HttpTestingController);
    http
      .expectOne("/api/products/catalog?page=0&size=100")
      .flush({}, { status: 503, statusText: "Unavailable" });
    expect(catalog.error()).not.toBe("");
    catalog.refresh();
    http
      .expectOne("/api/products/catalog?page=0&size=100")
      .flush({ content: [], page: 0, totalPages: 0, last: true });
    expect(catalog.error()).toBe("");
    expect(catalog.products()).toEqual([]);
    http.verify();
  });
});

describe("Cart", () => {
  function setup() {
    const products = signal([book]);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: Catalog,
          useValue: { products, loading: signal(false), error: signal("") },
        },
      ],
    });
    return { cart: TestBed.inject(Cart), products };
  }
  it("combines repeated books and calculates the real total", () => {
    const { cart } = setup();
    cart.add(book);
    cart.add(book);
    expect(cart.entries()).toEqual([{ productId: 1, quantity: 2 }]);
    expect(cart.total()).toBe(51);
    expect(cart.count()).toBe(2);
    expect(JSON.parse(localStorage.getItem("platon-store-cart")!)).toEqual(
      cart.entries(),
    );
  });
  it("blocks quantities above stock, fractional quantities and unavailable books", () => {
    const { cart } = setup();
    cart.add(book);
    cart.setQuantity(1, 4);
    cart.setQuantity(1, 1.5);
    cart.add({ ...book, available: false });
    expect(cart.count()).toBe(1);
    expect(cart.notice()).not.toBe("");
  });
  it("detects stock or price changes without trusting stored prices", () => {
    const { cart, products } = setup();
    cart.add(book);
    cart.add(book);
    products.set([{ ...book, salePrice: 30, stock: 1 }]);
    expect(cart.total()).toBe(60);
    expect(cart.valid()).toBe(false);
    cart.remove(1);
    expect(cart.count()).toBe(0);
  });
  it("ignores corrupted, duplicate or invalid saved entries", () => {
    localStorage.setItem(
      "platon-store-cart",
      JSON.stringify([
        { productId: 1, quantity: 1, salePrice: 0 },
        { productId: 1, quantity: 2 },
        { productId: 2, quantity: -1 },
        { productId: "3", quantity: 1 },
      ]),
    );
    const { cart } = setup();
    expect(cart.entries()).toEqual([{ productId: 1, quantity: 1 }]);
    expect(cart.total()).toBe(25.5);
  });
});

describe("Order integration", () => {
  function setup() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: Auth,
          useValue: { user: () => customer, isAuthenticated: () => true },
        },
      ],
    });
    return {
      purchases: TestBed.inject(Purchases),
      http: TestBed.inject(HttpTestingController),
    };
  }
  it("creates a pending order for the signed-in customer using the actual state ID", () => {
    const { purchases, http } = setup();
    const result = vi.fn();
    purchases.create([{ productId: 1, quantity: 2 }], 51).subscribe(result);
    http
      .expectOne("/api/states-sold")
      .flush([{ idStateSold: 71, nameState: "PENDIENTE" }]);
    const request = http.expectOne("/api/products-sold");
    expect(request.request.body).toEqual({
      idUser: 2,
      idStateSold: 71,
      totalAmount: 51,
      products: [{ idProducts: 1, numberSold: 2 }],
    });
    request.flush({ idProductsSold: 91 });
    expect(result).toHaveBeenCalledWith({ idProductsSold: 91 });
    http.verify();
  });
  it("sends only a simulation token and amount, never card details", () => {
    const { purchases, http } = setup();
    purchases.pay(91, 37.5).subscribe();
    const request = http.expectOne(
      "/api/products-sold/91/payment/simulate-card",
    );
    expect(request.request.body).toEqual({
      amount: 37.5,
      testToken: "visa-platinum-test",
    });
    request.flush({});
    http.verify();
  });
  it("filters every orders request by the current customer", () => {
    const { purchases, http } = setup();
    const result = vi.fn();
    purchases.list().subscribe(result);
    http
      .expectOne("/api/products-sold?idUser=2&page=0&size=100")
      .flush({ content: [], page: 0, totalPages: 2 });
    http
      .expectOne("/api/products-sold?idUser=2&page=1&size=100")
      .flush({ content: [], page: 1, totalPages: 2 });
    expect(result).toHaveBeenCalledWith([]);
    http.verify();
  });
  it("blocks a second submit while an order is being created and clears the cart only on success", () => {
    const response = new Subject<{ idProductsSold: number }>();
    const create = vi.fn(() => response);
    const clear = vi.fn();
    TestBed.configureTestingModule({
      imports: [CheckoutPage],
      providers: [
        provideRouter([]),
        {
          provide: Auth,
          useValue: { user: () => customer, isAuthenticated: () => true },
        },
        {
          provide: Catalog,
          useValue: { refresh: vi.fn(), loading: signal(false) },
        },
        { provide: Purchases, useValue: { create } },
        {
          provide: Cart,
          useValue: {
            entries: () => [{ productId: 1, quantity: 1 }],
            valid: () => true,
            total: () => 25.5,
            clear,
            notice: signal(""),
          },
        },
      ],
    });
    const navigate = vi
      .spyOn(TestBed.inject(Router), "navigate")
      .mockResolvedValue(true);
    const page = TestBed.createComponent(CheckoutPage).componentInstance;
    page.submit();
    page.submit();
    expect(create).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled();
    response.next({ idProductsSold: 91 });
    response.complete();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      ["/payment", 91],
      expect.objectContaining({ replaceUrl: true }),
    );
  });
});
