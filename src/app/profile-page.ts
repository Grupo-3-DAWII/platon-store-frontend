import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { Auth } from "./auth";
import { errorMessage } from "./store";
@Component({
  imports: [ReactiveFormsModule, RouterLink],
  template: ` <a routerLink="/" class="back-link">← Volver al catálogo</a>
    <section class="panel registration-wrap profile-page">
      <h1>Mi perfil</h1>
      <p class="muted">Mantén tus datos de contacto al día.</p>
      <div class="profile-identity">
        <img
          src="/images/avatar/user-avatar.png"
          alt=""
          class="profile-avatar"
        />
        <div>
          <strong>{{ auth.user()?.name }} {{ auth.user()?.lastname }}</strong>
          <p class="muted text-sm">{{ auth.user()?.email }} · Cliente</p>
        </div>
      </div>
      <form [formGroup]="form" (ngSubmit)="save()" class="registration-form">
        <div class="registration-grid">
          <div>
            <label for="profile-phone">Teléfono</label
            ><input
              id="profile-phone"
              formControlName="nro"
              type="tel"
              inputmode="tel"
              autocomplete="tel"
              maxlength="20"
              (input)="cleanPhone()"
            />
            @if (form.controls.nro.touched && form.controls.nro.invalid) {
              <p class="field-error">Usa entre 7 y 15 dígitos.</p>
            }
          </div>
          <div>
            <label for="profile-address">Dirección</label
            ><input
              id="profile-address"
              formControlName="direccion"
              autocomplete="street-address"
              maxlength="180"
            />
            @if (
              form.controls.direccion.touched && form.controls.direccion.invalid
            ) {
              <p class="field-error">Ingresa tu dirección.</p>
            }
          </div>
        </div>
        @if (error()) {
          <p role="alert" class="error-banner">{{ error() }}</p>
        }
        @if (saved()) {
          <p role="status" class="info-banner">Datos actualizados.</p>
        }
        <button class="btn" type="submit" [disabled]="busy()">
          {{ busy() ? "Guardando..." : "Guardar cambios" }}
        </button>
      </form>
    </section>`,
})
export class ProfilePage {
  readonly auth = inject(Auth);
  readonly busy = signal(false);
  readonly saved = signal(false);
  readonly error = signal("");
  readonly form = inject(FormBuilder).nonNullable.group({
    nro: [
      this.auth.user()?.nro ?? "",
      [Validators.required, Validators.pattern(/^[0-9]{7,15}$/)],
    ],
    direccion: [
      this.auth.user()?.direccion ?? "",
      [Validators.required, Validators.minLength(5), Validators.maxLength(180)],
    ],
  });
  cleanPhone() {
    const field = this.form.controls.nro;
    field.setValue(field.value.replace(/[^0-9]/g, "").slice(0, 15));
  }
  save() {
    if (this.busy()) return;
    this.form.controls.direccion.setValue(
      this.form.controls.direccion.value.trim().replace(/\s+/g, " "),
    );
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.saved.set(false);
    this.error.set("");
    this.auth
      .updateContact(this.form.getRawValue())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.saved.set(true),
        error: (err) =>
          this.error.set(
            errorMessage(err, "No se pudieron guardar los cambios."),
          ),
      });
  }
}
