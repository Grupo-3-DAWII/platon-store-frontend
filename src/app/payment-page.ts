import { CurrencyPipe } from "@angular/common";
import { Component, inject, signal } from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { finalize } from "rxjs";
import { Purchases, errorMessage } from "./store";
import { Order } from "./models";
const PAYMENT_CARDS: readonly {
  number: string;
  expiry: string;
  cvv: string;
  holder?: string;
}[] = [
  { number: "4242424242424242", expiry: "12/30", cvv: "123" },
  {
    number: "4110933720438861",
    expiry: "07/34",
    cvv: "109",
    holder: "Kimberly Hughes",
  },
  {
    number: "4732455816820933",
    expiry: "08/32",
    cvv: "511",
    holder: "Paul Miller",
  },
  {
    number: "4110934170668882",
    expiry: "03/34",
    cvv: "410",
    holder: "Steven Diaz",
  },
  {
    number: "4698943648512234",
    expiry: "04/32",
    cvv: "973",
    holder: "Ronald Peterson",
  },
  {
    number: "4222244196868168",
    expiry: "11/29",
    cvv: "110",
    holder: "Mark Kelly",
  },
];
const normalizeHolder = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase();
export function validTestCard(
  number: string,
  expiry: string,
  cvv: string,
  holder = "",
): boolean {
  return PAYMENT_CARDS.some(
    (card) =>
      card.number === number.replace(/\s/g, "") &&
      card.expiry === expiry &&
      card.cvv === cvv &&
      (!card.holder ||
        normalizeHolder(card.holder) === normalizeHolder(holder)),
  );
}
@Component({
  imports: [CurrencyPipe, ReactiveFormsModule, RouterLink],
  template: `
    <a routerLink="/orders" class="back-link">← Mis pedidos</a>
    <div class="section-heading">
      <div>
        <h1>Pago del pedido</h1>
      </div>
    </div>
    @if (loading()) {
      <p class="empty" role="status">Cargando pedido...</p>
    }
    @if (error()) {
      <p role="alert" class="error-banner">{{ error() }}</p>
    }
    @if (order(); as current) {
      @if (current.stateSold.nameState === "PAGADO") {
        <section class="panel payment-result">
          <span class="payment-check" aria-hidden="true">✓</span>
          <h2>Pago aprobado</h2>
          <p>Tu pedido #{{ current.idProductsSold }} está pagado.</p>
          <p class="muted">
            {{
              current.paymentMethod === "VISA_PLATINUM_SIMULATED"
                ? "Tarjeta · Visa"
                : "Pago registrado"
            }}
          </p>
          @if (current.paymentReference) {
            <p class="text-xs muted">
              Referencia: {{ current.paymentReference.replace("SIM-", "") }}
            </p>
          }
          <a routerLink="/orders" class="btn">Ver mis pedidos</a>
        </section>
      } @else if (
        current.stateSold.nameState === "PENDIENTE" &&
        current.totalAmount !== null
      ) {
        <div class="checkout-grid payment-grid">
          <section class="panel checkout-details">
            <div class="card-preview" aria-hidden="true">
              <div class="card-rotator" [class.card-flipped]="cardFlipped()">
                <div class="card-face card-front">
                  <div class="card-brand">
                    <span>Platón </span
                    ><strong>VISA</strong>
                  </div>
                  <span class="card-chip"></span>
                  <p class="card-number-preview">{{ previewNumber() }}</p>
                  <div class="card-front-bottom">
                    <div class="card-holder-preview">
                      <small>Titular</small
                      ><span>{{
                        form.controls.holder.value || "NOMBRE Y APELLIDO"
                      }}</span>
                    </div>
                    <div class="card-expiry-preview">
                      <small>Vence</small
                      ><span>{{ form.controls.expiry.value || "MM/AA" }}</span>
                    </div>
                  </div>
                </div>
                <div class="card-face card-back">
                  <div class="card-magnetic-strip"></div>
                  <div class="card-signature">
                    <span>{{
                      form.controls.holder.value || "Firma del titular"
                    }}</span
                    ><strong>{{ form.controls.cvv.value || "•••" }}</strong>
                  </div>
                  <p class="card-cvv-caption">CVV</p>
                  <div class="card-back-brand">
                    Platón <strong>VISA</strong>
                  </div>
                </div>
              </div>
            </div>
            <form
              [formGroup]="form"
              (ngSubmit)="pay()"
              class="registration-form"
            >
              <div class="registration-grid">
                <div class="field-wide">
                  <label for="card-holder">Nombre del titular</label>
                  <input
                    id="card-holder"
                    formControlName="holder"
                    maxlength="60"
                    placeholder="Como aparece en tu tarjeta"
                    autocomplete="off"
                    (input)="formatHolder()"
                  />
                  @if (
                    form.controls.holder.touched && form.controls.holder.invalid
                  ) {
                    <p class="field-error">Ingresa el nombre del titular.</p>
                  }
                </div>
                <div class="field-wide">
                  <label for="card-number">Número de tarjeta</label
                  ><input
                    id="card-number"
                    formControlName="number"
                    inputmode="numeric"
                    maxlength="19"
                    placeholder="0000 0000 0000 0000"
                    autocomplete="off"
                    (input)="formatNumber()"
                  />
                </div>
                <div>
                  <label for="card-expiry">Vencimiento</label
                  ><input
                    id="card-expiry"
                    formControlName="expiry"
                    inputmode="numeric"
                    maxlength="5"
                    placeholder="MM/AA"
                    autocomplete="off"
                    (input)="formatExpiry()"
                  />
                </div>
                <div>
                  <label for="card-cvv">CVV</label
                  ><input
                    id="card-cvv"
                    formControlName="cvv"
                    type="password"
                    inputmode="numeric"
                    maxlength="3"
                    placeholder="•••"
                    autocomplete="off"
                    (input)="formatCvv()"
                    (focus)="cardFlipped.set(true)"
                    (blur)="cardFlipped.set(false)"
                  />
                </div>
              </div>
              @if (cardError()) {
                <p class="field-error" role="alert">{{ cardError() }}</p>
              }
              <button type="submit" class="btn w-full" [disabled]="busy()">
                {{
                  busy()
                    ? "Procesando pago..."
                    : "Pagar " +
                      (current.totalAmount | currency: "PEN" : "S/ " : "1.2-2")
                }}
              </button>
            </form>
          </section>
          <aside class="summary panel">
            <h2>Pedido #{{ current.idProductsSold }}</h2>
            @for (item of current.products; track item.idProducts) {
              <div class="review-line">
                <span
                  >{{ item.product?.name || "Libro" }} ×
                  {{ item.numberSold }}</span
                ><span>{{
                  item.subtotal | currency: "PEN" : "S/ " : "1.2-2"
                }}</span>
              </div>
            }
            <div class="summary-total">
              <span>Total</span
              ><strong>{{
                current.totalAmount | currency: "PEN" : "S/ " : "1.2-2"
              }}</strong>
            </div>
          </aside>
        </div>
      } @else {
        <p class="empty">Este pedido no está disponible para pagar.</p>
      }
    }
  `,
})
export class PaymentPage {
  private readonly purchases = inject(Purchases);
  private readonly id = Number(
    inject(ActivatedRoute).snapshot.paramMap.get("id"),
  );
  readonly order = signal<Order | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal("");
  readonly cardError = signal("");
  readonly cardFlipped = signal(false);
  readonly form = inject(FormBuilder).nonNullable.group({
    holder: [
      "",
      [
        Validators.required,
        Validators.minLength(2),
        Validators.maxLength(60),
        Validators.pattern(/^[\p{L}\p{M} '-]+$/u),
      ],
    ],
    number: ["", Validators.required],
    expiry: ["", Validators.required],
    cvv: ["", Validators.required],
  });
  constructor() {
    this.load();
  }
  load() {
    if (!Number.isSafeInteger(this.id) || this.id < 1) {
      this.loading.set(false);
      this.error.set("Pedido no encontrado.");
      return;
    }
    this.purchases
      .get(this.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (order) => this.order.set(order),
        error: (err) =>
          this.error.set(errorMessage(err, "No se pudo cargar el pedido.")),
      });
  }
  previewNumber(): string {
    return this.form.controls.number.value
      .replace(/\D/g, "")
      .padEnd(16, "•")
      .match(/.{1,4}/g)!
      .join(" ");
  }
  formatHolder() {
    const control = this.form.controls.holder;
    control.setValue(
      control.value.replace(/[^\p{L}\p{M} '-]/gu, "").slice(0, 60),
    );
  }
  formatNumber() {
    const c = this.form.controls.number;
    c.setValue(
      c.value
        .replace(/\D/g, "")
        .slice(0, 16)
        .replace(/(.{4})/g, "$1 ")
        .trim(),
    );
  }
  formatExpiry() {
    const c = this.form.controls.expiry;
    const v = c.value.replace(/\D/g, "").slice(0, 4);
    c.setValue(v.length > 2 ? v.slice(0, 2) + "/" + v.slice(2) : v);
  }
  formatCvv() {
    const c = this.form.controls.cvv;
    c.setValue(c.value.replace(/\D/g, "").slice(0, 3));
  }
  pay() {
    const order = this.order();
    if (
      this.busy() ||
      !order ||
      order.stateSold.nameState !== "PENDIENTE" ||
      order.totalAmount === null
    )
      return;
    this.form.controls.holder.setValue(
      this.form.controls.holder.value.trim().replace(/\s+/g, " "),
    );
    this.form.markAllAsTouched();
    const { number, expiry, cvv, holder } = this.form.getRawValue();
    this.cardError.set("");
    this.error.set("");
    if (this.form.invalid || !validTestCard(number, expiry, cvv, holder)) {
      this.cardError.set("Revisa los datos de la tarjeta.");
      return;
    }
    this.busy.set(true);
    this.purchases
      .pay(order.idProductsSold, order.totalAmount)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.cardFlipped.set(false);
          this.form.reset();
          this.load();
        },
        error: (err) => {
          this.error.set(
            errorMessage(
              err,
              "No se pudo confirmar el pago. Puedes volver a intentarlo.",
            ),
          );
          this.load();
        },
      });
  }
}
