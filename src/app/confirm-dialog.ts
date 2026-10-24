import {
  afterRenderEffect,
  Component,
  ElementRef,
  inject,
  Injectable,
  signal,
  viewChild,
} from "@angular/core";

interface Confirmation {
  title: string;
  message: string;
  label: string;
  danger: boolean;
  resolve: (answer: boolean) => void;
}
@Injectable({ providedIn: "root" })
export class ConfirmationService {
  readonly request = signal<Confirmation | null>(null);
  ask(
    title: string,
    message: string,
    label = "Confirmar",
    danger = false,
  ): Promise<boolean> {
    if (this.request()) return Promise.resolve(false);
    return new Promise((resolve) =>
      this.request.set({ title, message, label, danger, resolve }),
    );
  }
  answer(value: boolean): void {
    const current = this.request();
    this.request.set(null);
    current?.resolve(value);
  }
}
@Component({
  selector: "app-confirm-dialog",
  template: `<dialog
    #dialog
    class="confirmation-dialog"
    aria-labelledby="confirmation-title"
    aria-describedby="confirmation-message"
    (cancel)="cancel($event)"
  >
    @if (service.request(); as request) {
      <div class="confirmation-top">
        <span class="confirmation-icon" [class.destructive]="request.danger"
          ><img
            [src]="
              request.danger
                ? '/icons/hicon/circle-danger.svg'
                : '/icons/hicon/logout.svg'
            "
            alt=""
            width="22"
            height="22" /></span
        ><button
          type="button"
          class="confirmation-close"
          aria-label="Cerrar confirmación"
          (click)="service.answer(false)"
        >
          ×
        </button>
      </div>
      <h2 id="confirmation-title">{{ request.title }}</h2>
      <p id="confirmation-message">{{ request.message }}</p>
      <div class="confirmation-actions">
        <button
          type="button"
          class="confirmation-secondary"
          autofocus
          (click)="service.answer(false)"
        >
          Volver</button
        ><button
          type="button"
          class="confirmation-primary"
          [class.destructive]="request.danger"
          (click)="service.answer(true)"
        >
          {{ request.label }}
        </button>
      </div>
    }
  </dialog>`,
  styles: [
    `
      .confirmation-dialog {
        margin: auto;
        width: min(92vw, 440px);
        max-height: 90dvh;
        overflow: auto;
        border: 1px solid #e4ebe8;
        border-radius: 24px;
        padding: 26px;
        background: #fff;
        color: #202827;
        font: inherit;
        box-shadow: 0 24px 80px #152d2940;
      }
      .confirmation-dialog::backdrop {
        background: #152d2966;
        backdrop-filter: blur(4px);
      }
      .confirmation-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 18px;
      }
      .confirmation-icon {
        display: grid;
        place-items: center;
        width: 46px;
        height: 46px;
        border-radius: 15px;
        background: #e8f3ee;
      }
      .confirmation-icon.destructive {
        background: #fbece9;
      }
      .confirmation-close {
        display: grid;
        place-items: center;
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 50%;
        background: #f4f6f5;
        color: #68706e;
        font-size: 24px;
        cursor: pointer;
      }
      h2 {
        font-size: 22px;
        line-height: 1.25;
        font-weight: 700;
        margin: 0 0 12px;
        letter-spacing: -0.4px;
      }
      p {
        font-size: 14px;
        line-height: 1.65;
        color: #68706e;
        margin: 0;
      }
      .confirmation-actions {
        display: flex;
        justify-content: flex-end;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 24px;
        padding-top: 20px;
        border-top: 1px solid #ecefe9;
      }
      .confirmation-actions button {
        min-height: 44px;
        padding: 10px 20px;
        border-radius: 999px;
        font: inherit;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      }
      .confirmation-secondary {
        border: 1px solid #dce4e0;
        background: #fff;
        color: #43504c;
      }
      .confirmation-primary {
        border: 1px solid #3e9786;
        background: #3e9786;
        color: #fff;
      }
      .confirmation-primary.destructive {
        border-color: #b74f46;
        background: #b74f46;
      }
      button:focus-visible {
        outline: 3px solid #3e978640;
        outline-offset: 3px;
      }
      .confirmation-primary:hover {
        filter: brightness(0.94);
      }
      @media (prefers-reduced-motion: no-preference) {
        .confirmation-dialog[open] {
          animation: confirmation-in 0.16s ease-out;
        }
        @keyframes confirmation-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      }
    `,
  ],
})
export class ConfirmDialog {
  readonly service = inject(ConfirmationService);
  readonly dialog = viewChild<ElementRef<HTMLDialogElement>>("dialog");
  constructor() {
    afterRenderEffect(() => {
      const element = this.dialog()?.nativeElement;
      if (!element) return;
      if (this.service.request() && !element.open) element.showModal();
      else if (!this.service.request() && element.open) element.close();
    });
  }
  cancel(event: Event): void {
    event.preventDefault();
    this.service.answer(false);
  }
}
