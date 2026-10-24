import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { merge } from "rxjs";
import {
  AbstractControl,
  NonNullableFormBuilder,
  ValidatorFn,
  Validators,
} from "@angular/forms";

export type AccountInputKind =
  "name" | "username" | "email" | "phone" | "address";
export const ACCOUNT_FIELDS = [
  { name: "name", label: "Nombres", type: "text", max: 80, kind: "name" },
  { name: "lastname", label: "Apellidos", type: "text", max: 80, kind: "name" },
  {
    name: "username",
    label: "Usuario",
    type: "text",
    max: 80,
    kind: "username",
  },
  {
    name: "email",
    label: "Correo electrónico",
    type: "email",
    max: 120,
    kind: "email",
  },
  { name: "nro", label: "Contacto", type: "tel", max: 20, kind: "phone" },
  {
    name: "direccion",
    label: "Dirección",
    type: "text",
    max: 180,
    kind: "address",
  },
] as const;

const NAME_PATTERN = /^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^(?=.*\d)\+?[\d ()-]+$/;

export function sanitizeAccountInput(
  raw: string,
  kind: AccountInputKind,
  finish = false,
): string {
  const printable = Array.from(raw.normalize("NFC"))
    .filter((character) => {
      const code = character.codePointAt(0)!;
      return (
        (code >= 32 || [9, 10, 13].includes(code)) && (code < 127 || code > 159)
      );
    })
    .join("");
  let value = printable.replace(
    /[\u200b-\u200f\u202a-\u202e\u2066-\u2069\ufeff]/g,
    "",
  );
  if (kind === "name" || kind === "address" || kind === "phone")
    value = value.replace(/\s+/g, " ");
  if (kind === "name") value = value.replace(/[^\p{L}\p{M} '\u2019-]/gu, "");
  if (kind === "username") value = value.replace(/[^a-zA-Z0-9._-]/g, "");
  if (kind === "email") value = value.replace(/\s/g, "");
  if (kind === "phone") value = value.replace(/[^\d+ ()-]/g, "");
  if (kind === "name" || kind === "address" || kind === "phone")
    value = value.replace(/\s+/g, " ");
  return finish ? value.trim() : value;
}

const contactLength: ValidatorFn = (control) => {
  const value = String(control.value ?? "");
  if (!value) return null;
  const digits = value.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15 ? null : { phoneLength: true };
};

export const passwordByteLimit: ValidatorFn = (control) =>
  typeof control.value === "string" &&
  new TextEncoder().encode(control.value).length > 72
    ? { passwordBytes: true }
    : null;

export function passwordValidators(required = false): ValidatorFn[] {
  return [
    ...(required ? [Validators.required] : []),
    Validators.minLength(10),
    Validators.maxLength(72),
    passwordByteLimit,
  ];
}

export function createAccountForm(fb: NonNullableFormBuilder) {
  return fb.group({
    name: [
      "",
      [
        Validators.required,
        Validators.maxLength(80),
        Validators.pattern(NAME_PATTERN),
      ],
    ],
    lastname: [
      "",
      [
        Validators.required,
        Validators.maxLength(80),
        Validators.pattern(NAME_PATTERN),
      ],
    ],
    username: [
      "",
      [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(80),
        Validators.pattern("[a-zA-Z0-9._-]+"),
      ],
    ],
    email: [
      "",
      [
        Validators.required,
        Validators.email,
        Validators.maxLength(120),
        Validators.pattern(EMAIL_PATTERN),
      ],
    ],
    nro: [
      "",
      [
        Validators.required,
        Validators.maxLength(20),
        Validators.pattern(PHONE_PATTERN),
        contactLength,
      ],
    ],
    direccion: ["", [Validators.required, Validators.maxLength(180)]],
    idStatus: [0, [Validators.required, Validators.min(1)]],
    idRole: [0, [Validators.required, Validators.min(1)]],
    password: ["", passwordValidators()],
  });
}

export function normalizeAccountForm(
  form: ReturnType<typeof createAccountForm>,
): void {
  for (const field of ACCOUNT_FIELDS) {
    const control = form.controls[field.name];
    control.setValue(sanitizeAccountInput(control.value, field.kind, true), {
      emitEvent: false,
    });
  }
}

export function accountFieldError(
  control: AbstractControl,
  field: string,
): string {
  if (control.hasError("required")) return "Campo obligatorio.";
  if (control.hasError("duplicate")) return "Ya registrado.";
  if (control.hasError("maxlength"))
    return `Máximo ${control.getError("maxlength").requiredLength} caracteres.`;
  if (control.hasError("passwordBytes")) return "Contraseña demasiado larga.";
  if (control.hasError("minlength"))
    return `Mínimo ${control.getError("minlength").requiredLength} caracteres.`;
  if (control.hasError("phoneLength")) return "Usa 7 a 15 dígitos.";
  if (
    control.hasError("email") ||
    (field === "email" && control.hasError("pattern"))
  )
    return "Correo inválido.";
  if (control.hasError("pattern")) {
    if (field === "name" || field === "lastname") return "Solo letras.";
    if (field === "username") return "Usa letras, números, punto o guion.";
    if (field === "nro") return "Contacto inválido.";
  }
  return "Revisa este campo.";
}

interface AccountIdentity {
  idUser: number;
  username: string;
  email: string;
  nro: string;
}
export type DuplicateField = "username" | "email" | "nro";
export function findDuplicateAccountFields(
  accounts: AccountIdentity[],
  request: Omit<AccountIdentity, "idUser">,
  excludeId?: number,
): DuplicateField[] {
  const key = (value: string, field: DuplicateField) =>
    field === "nro"
      ? String(value ?? "").replace(/\D/g, "")
      : String(value ?? "")
          .normalize("NFC")
          .trim()
          .toLowerCase();
  return (["username", "email", "nro"] as const).filter((field) =>
    accounts.some(
      (account) =>
        account.idUser !== excludeId &&
        key(account[field], field) === key(request[field], field),
    ),
  );
}

export function suggestedUsername(name: string, lastname: string): string {
  const part = (value: string) =>
    sanitizeAccountInput(value, "name", true)
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLowerCase()
      .split(/\s+/)[0]
      .replace(/[^a-z0-9]/g, "");
  const first = part(name);
  const last = part(lastname);
  return first && last ? `${first}${last}`.slice(0, 80) : "";
}

export function enableUsernameSuggestion(
  form: ReturnType<typeof createAccountForm>,
  enabled: () => boolean,
): void {
  merge(form.controls.name.valueChanges, form.controls.lastname.valueChanges)
    .pipe(takeUntilDestroyed())
    .subscribe(() => {
      if (!enabled() || form.controls.username.dirty) return;
      const suggested = suggestedUsername(
        form.controls.name.value,
        form.controls.lastname.value,
      );
      if (suggested !== form.controls.username.value)
        form.controls.username.setValue(suggested, { emitEvent: false });
    });
}
