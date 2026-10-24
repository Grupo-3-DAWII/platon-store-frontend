import { Directive, ElementRef, inject, input } from "@angular/core";
import { NgControl } from "@angular/forms";
import {
  AccountInputKind,
  sanitizeAccountInput,
} from "../utils/account-inputs";

@Directive({
  selector: "input[appSanitize]",
  host: {
    "(input)": "onInput($event)",
    "(compositionend)": "apply()",
    "(blur)": "apply(true)",
  },
})
export class SanitizeInput {
  readonly appSanitize = input.required<AccountInputKind>();
  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private readonly control = inject(NgControl, { self: true, optional: true });

  onInput(event: InputEvent): void {
    if (!event.isComposing) this.apply();
  }

  apply(finish = false): void {
    const element = this.element.nativeElement;
    const original = element.value;
    const cleaned = sanitizeAccountInput(original, this.appSanitize(), finish);
    if (cleaned === original) return;
    const caret = element.selectionStart;
    const position =
      caret === null
        ? null
        : sanitizeAccountInput(
            original.slice(0, caret),
            this.appSanitize(),
            finish,
          ).length;
    element.value = cleaned;
    this.control?.control?.setValue(cleaned, { emitEvent: false });
    if (position !== null && element.type !== "email")
      element.setSelectionRange(position, position);
  }
}
