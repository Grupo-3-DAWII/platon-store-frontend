import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { Auth } from "./auth";
import { errorMessage } from "./store";

@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <a routerLink="/" class="back-link">← Volver al catálogo</a>
    <section class="login-layout">
      <form class="panel login-form" [formGroup]="form" (ngSubmit)="submit()">
        <h1>Iniciar sesión</h1>
        <p class="muted">Ingresa con tu cuenta de cliente.</p>
        @if (registered) {
          <p role="status" class="info-banner">
            Cuenta creada. Ya puedes iniciar sesión.
          </p>
        }
        <label
          >Usuario<input
            autocomplete="username"
            formControlName="username"
            maxlength="80"
            [attr.aria-invalid]="
              form.controls.username.touched && form.controls.username.invalid
            "
        /></label>
        @if (form.controls.username.touched && form.controls.username.invalid) {
          <p class="field-error">Ingresa tu usuario.</p>
        }
        <label
          >Contraseña
          <div class="password-field">
            <input
              [type]="showPassword() ? 'text' : 'password'"
              autocomplete="current-password"
              formControlName="password"
              maxlength="72"
              [attr.aria-invalid]="
                form.controls.password.touched && form.controls.password.invalid
              "
            /><button
              type="button"
              (click)="showPassword.update(toggle)"
              [attr.aria-label]="
                showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'
              "
            >
              {{ showPassword() ? "Ocultar" : "Mostrar" }}
            </button>
          </div></label
        >
        @if (form.controls.password.touched && form.controls.password.invalid) {
          <p class="field-error">Ingresa tu contraseña.</p>
        }
        @if (error()) {
          <p role="alert" class="error-banner">{{ error() }}</p>
        }
        <button class="btn w-full" type="submit" [disabled]="busy()">
          {{ busy() ? "Ingresando..." : "Ingresar" }}
        </button>
        <p class="text-sm muted">
          ¿No tienes cuenta?
          <a
            class="text-link"
            routerLink="/register"
            [queryParams]="{ returnUrl }"
            >Crear cuenta</a
          >
        </p>
      </form>
    </section>
  `,
})
export class LoginPage {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly registered =
    this.route.snapshot.queryParamMap.get("registered") === "1";
  readonly returnUrl =
    this.route.snapshot.queryParamMap.get("returnUrl") === "/checkout"
      ? "/checkout"
      : "/";
  readonly busy = signal(false);
  readonly error = signal("");
  readonly showPassword = signal(false);
  readonly toggle = (value: boolean) => !value;
  readonly form = inject(FormBuilder).nonNullable.group({
    username: ["", [Validators.required, Validators.pattern(/\S/)]],
    password: ["", Validators.required],
  });
  submit(): void {
    if (this.busy()) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set("");
    const { username, password } = this.form.getRawValue();
    this.auth
      .login(username, password)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          const destination =
            this.route.snapshot.queryParamMap.get("returnUrl");
          void this.router.navigateByUrl(
            destination === "/checkout" ||
              destination === "/orders" ||
              destination === "/profile" ||
              /^\/payment\/[1-9][0-9]*$/.test(destination ?? "")
              ? destination!
              : "/",
          );
        },
        error: (error) =>
          this.error.set(
            error?.status === 401
              ? "Usuario o contraseña incorrectos."
              : errorMessage(error, "No se pudo iniciar sesión."),
          ),
      });
  }
}
