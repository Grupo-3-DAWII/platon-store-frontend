import { computed, inject, Injectable, signal } from "@angular/core";
import {
  HttpClient,
  HttpErrorResponse,
  HttpInterceptorFn,
} from "@angular/common/http";
import { CanActivateFn, Router } from "@angular/router";
import { catchError, map, switchMap, tap, throwError } from "rxjs";
import { Account, Session } from "./models";

export function tokenClaims(token: string): {
  idUser: number;
  sub: string;
  exp: number;
} {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("token");
    const raw = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(
          atob(raw.padEnd(Math.ceil(raw.length / 4) * 4, "=")),
          (c) => c.charCodeAt(0),
        ),
      ),
    );
    if (
      !Number.isSafeInteger(claims.idUser) ||
      claims.idUser < 1 ||
      typeof claims.sub !== "string" ||
      !Number.isFinite(claims.exp) ||
      claims.exp * 1000 <= Date.now()
    )
      throw new Error("claims");
    return claims;
  } catch {
    throw new Error("La sesión no es válida. Vuelve a ingresar.");
  }
}

@Injectable({ providedIn: "root" })
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly key = "platon-store-session";
  readonly session = signal<Session | null>(this.restore());
  readonly user = computed(() => this.session()?.user ?? null);

  isAuthenticated(): boolean {
    return !!this.session() && this.session()!.expiresAt > Date.now();
  }
  login(username: string, password: string) {
    this.logout();
    return this.http
      .post<{ access_token: string }>("/api/v1/login", {
        username: username.trim(),
        password,
      })
      .pipe(
        switchMap(({ access_token }) => {
          const claims = tokenClaims(access_token);
          return this.http
            .get<Account>(`/api/accounts/${claims.idUser}`, {
              headers: { Authorization: `Bearer ${access_token}` },
            })
            .pipe(
              map((user): Session => {
                if (!["USER", "CUSTOMER"].includes(user.role.toUpperCase()))
                  throw new Error(
                    "Esta tienda es para clientes. Usa el panel administrativo para ingresar con tu cuenta de trabajo.",
                  );
                if (
                  user.idUser !== claims.idUser ||
                  user.username !== claims.sub ||
                  user.status.toLowerCase() !== "active"
                )
                  throw new Error("La cuenta no está disponible.");
                return {
                  token: access_token,
                  expiresAt: claims.exp * 1000,
                  user,
                };
              }),
            );
        }),
        tap((session) => {
          sessionStorage.setItem(this.key, JSON.stringify(session));
          this.session.set(session);
        }),
      );
  }
  register(request: {
    name: string;
    lastname: string;
    username: string;
    email: string;
    nro: string;
    direccion: string;
    password: string;
  }) {
    return this.http.post<Account>("/api/accounts/register", request);
  }
  updateContact(request: { nro: string; direccion: string }) {
    return this.http.put<Account>("/api/accounts/me/contact", request).pipe(
      tap((user) => {
        const session = this.session();
        if (!session || session.user.idUser !== user.idUser) return;
        const updated = { ...session, user };
        sessionStorage.setItem(this.key, JSON.stringify(updated));
        this.session.set(updated);
      }),
    );
  }
  logout(): void {
    sessionStorage.removeItem(this.key);
    this.session.set(null);
  }
  private restore(): Session | null {
    try {
      const stored = sessionStorage.getItem(this.key);
      if (stored) {
        const session: Session = JSON.parse(stored);
        const claims = tokenClaims(session.token);
        if (
          claims.idUser === session.user.idUser &&
          claims.sub === session.user.username &&
          session.expiresAt === claims.exp * 1000 &&
          ["USER", "CUSTOMER"].includes(session.user.role.toUpperCase())
        )
          return session;
      }
    } catch {
      sessionStorage.removeItem(this.key);
    }
    return null;
  }
}

export const customerGuard: CanActivateFn = (_, state) =>
  inject(Auth).isAuthenticated() ||
  inject(Router).createUrlTree(["/login"], {
    queryParams: { returnUrl: state.url },
  });

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);
  const router = inject(Router);
  if (!request.url.startsWith("/api/")) return next(request);
  const token = auth.isAuthenticated() ? auth.session()?.token : null;
  const authorized =
    token && !request.headers.has("Authorization")
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request;
  return next(authorized).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        auth.logout();
        const returnUrl = router.url.startsWith("/checkout")
          ? "/checkout"
          : "/orders";
        void router.navigate(["/login"], { queryParams: { returnUrl } });
      }
      return throwError(() => error);
    }),
  );
};
