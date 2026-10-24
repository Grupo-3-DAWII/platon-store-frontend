import { Component, inject, signal } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import { finalize, merge } from "rxjs";
import { Auth } from "./auth";
import { errorMessage } from "./store";
import { SanitizeInput } from "./shared/directives/sanitize-input.directive";
import {
  ACCOUNT_FIELDS,
  accountFieldError,
  createAccountForm,
  passwordValidators,
  sanitizeAccountInput,
  suggestedUsername,
} from "./shared/utils/account-inputs";

@Component({
  imports: [ReactiveFormsModule, RouterLink, SanitizeInput],
  template: `
    <a routerLink="/" class="back-link">← Volver al catálogo</a>
    <section class="registration-wrap panel">
      <h1>Crear cuenta</h1>
      <p class="muted">Completa tus datos para realizar pedidos.</p>
      <form [formGroup]="form" (ngSubmit)="submit()" class="registration-form">
        <fieldset [disabled]="busy()" class="registration-grid">
          @for (field of fields; track field.name) {
            <div>
              <label [for]="'register-' + field.name">{{ field.label }}</label
              ><input
                [id]="'register-' + field.name"
                [type]="field.type"
                [formControlName]="field.name"
                [appSanitize]="field.kind"
                [attr.maxlength]="field.max"
                [attr.autocomplete]="autocomplete(field.name)"
                [attr.aria-invalid]="
                  form.controls[field.name].touched &&
                  form.controls[field.name].invalid
                "
              />
              @if (
                form.controls[field.name].touched &&
                form.controls[field.name].invalid
              ) {
                <p class="field-error">{{ fieldError(field.name) }}</p>
              }
            </div>
          }
          <div>
            <label for="register-password">Contraseña</label
            ><input
              id="register-password"
              type="password"
              autocomplete="new-password"
              formControlName="password"
              maxlength="72"
              [attr.aria-invalid]="
                form.controls.password.touched && form.controls.password.invalid
              "
            />
            @if (
              form.controls.password.touched && form.controls.password.invalid
            ) {
              <p class="field-error">{{ fieldError("password") }}</p>
            } @else {
              <p class="muted text-xs">Mínimo 10 caracteres.</p>
            }
          </div>
          <div>
            <label for="register-confirm">Repetir contraseña</label
            ><input
              id="register-confirm"
              type="password"
              autocomplete="new-password"
              formControlName="confirmPassword"
              maxlength="72"
              [attr.aria-invalid]="
                form.controls.confirmPassword.touched &&
                form.hasError('passwordMismatch')
              "
            />
            @if (
              form.controls.confirmPassword.touched &&
              form.hasError("passwordMismatch")
            ) {
              <p class="field-error">Las contraseñas no coinciden.</p>
            }
          </div>
        </fieldset>
        @if (error()) {
          <p role="alert" class="error-banner">{{ error() }}</p>
        }
        <button class="btn" type="submit" [disabled]="busy()">
          {{ busy() ? "Creando cuenta..." : "Crear cuenta" }}
        </button>
        <p class="text-sm muted">
          ¿Ya tienes una cuenta?
          <a class="text-link" routerLink="/login" [queryParams]="{ returnUrl }"
            >Iniciar sesión</a
          >
        </p>
      </form>
    </section>
  `,
})
export class RegisterPage {
  private readonly auth = inject(Auth);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;
  readonly returnUrl =
    inject(ActivatedRoute).snapshot.queryParamMap.get("returnUrl") ===
    "/checkout"
      ? "/checkout"
      : "/";
  readonly fields = ACCOUNT_FIELDS;
  readonly busy = signal(false);
  readonly error = signal("");
  private readonly accountForm = createAccountForm(this.fb);
  readonly form = this.fb.group(
    {
      name: this.accountForm.controls.name,
      lastname: this.accountForm.controls.lastname,
      username: this.accountForm.controls.username,
      email: this.accountForm.controls.email,
      nro: this.accountForm.controls.nro,
      direccion: this.accountForm.controls.direccion,
      password: ["", passwordValidators(true)],
      confirmPassword: ["", Validators.required],
    },
    {
      validators: (group) =>
        group.get("password")?.value === group.get("confirmPassword")?.value
          ? null
          : { passwordMismatch: true },
    },
  );
  constructor() {
    merge(
      this.form.controls.name.valueChanges,
      this.form.controls.lastname.valueChanges,
    )
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        if (!this.form.controls.username.dirty)
          this.form.controls.username.setValue(
            suggestedUsername(
              this.form.controls.name.value,
              this.form.controls.lastname.value,
            ),
          );
      });
  }
  fieldError(field: keyof typeof this.form.controls): string {
    return accountFieldError(this.form.controls[field], field);
  }
  autocomplete(field: string): string {
    return (
      {
        name: "given-name",
        lastname: "family-name",
        username: "username",
        email: "email",
        nro: "tel",
        direccion: "street-address",
      } as Record<string, string>
    )[field];
  }
  submit(): void {
    if (this.busy()) return;
    for (const field of this.fields) {
      const control = this.form.controls[field.name];
      control.setValue(sanitizeAccountInput(control.value, field.kind, true), {
        emitEvent: false,
      });
    }
    this.form.controls.username.setValue(
      this.form.controls.username.value.toLowerCase(),
    );
    this.form.controls.email.setValue(
      this.form.controls.email.value.toLowerCase(),
    );
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set("");
    const { name, lastname, username, email, nro, direccion, password } =
      this.form.getRawValue();
    const request = {
      name,
      lastname,
      username,
      email,
      nro,
      direccion,
      password,
    };
    this.auth
      .register(request)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.form.controls.password.reset();
          this.form.controls.confirmPassword.reset();
          void this.router.navigate(["/login"], {
            queryParams: { registered: "1", returnUrl: this.returnUrl },
            replaceUrl: true,
          });
        },
        error: (error) =>
          this.error.set(errorMessage(error, "No se pudo crear la cuenta.")),
      });
  }
}
