import { TestBed } from "@angular/core/testing";
import { provideRouter, Router } from "@angular/router";
import { HttpErrorResponse } from "@angular/common/http";
import { Subject } from "rxjs";
import { Auth } from "./auth";
import { RegisterPage } from "./register-page";
import { Account } from "./models";

const data = {
  name: "María",
  lastname: "Pérez",
  username: "mariaperez",
  email: "maria@example.test",
  nro: "900000020",
  direccion: "Calle 20",
  password: "Cliente123!",
  confirmPassword: "Cliente123!",
};

function setup() {
  const response = new Subject<Account>();
  const register = vi.fn<(request: Record<string, string>) => Subject<Account>>(
    () => response,
  );
  TestBed.configureTestingModule({
    imports: [RegisterPage],
    providers: [provideRouter([]), { provide: Auth, useValue: { register } }],
  });
  const navigate = vi
    .spyOn(TestBed.inject(Router), "navigate")
    .mockResolvedValue(true);
  const fixture = TestBed.createComponent(RegisterPage);
  fixture.detectChanges();
  return {
    page: fixture.componentInstance,
    fixture,
    register,
    response,
    navigate,
  };
}

describe("Customer registration form", () => {
  afterEach(() => vi.restoreAllMocks());
  it("submits customer fields without role or status and preserves the login destination", () => {
    const { page, register, response, navigate } = setup();
    page.form.setValue(data);
    page.submit();
    page.submit();
    expect(register).toHaveBeenCalledTimes(1);
    expect(Object.keys(register.mock.calls[0][0]).sort()).toEqual([
      "direccion",
      "email",
      "lastname",
      "name",
      "nro",
      "password",
      "username",
    ]);
    response.next({
      idUser: 9,
      username: "mariaperez",
      name: "María",
      lastname: "Pérez",
      role: "USER",
      status: "active",
    });
    response.complete();
    expect(page.form.controls.password.value).toBe("");
    expect(navigate).toHaveBeenCalledWith(["/login"], {
      queryParams: { registered: "1", returnUrl: "/" },
      replaceUrl: true,
    });
  });
  it("blocks mismatched passwords, numbers in names and oversized password bytes", () => {
    const { page, register } = setup();
    page.form.setValue({ ...data, confirmPassword: "Different123!" });
    page.submit();
    expect(register).not.toHaveBeenCalled();
    page.form.setValue({ ...data, name: "María123" });
    expect(page.form.controls.name.invalid).toBe(true);
    page.form.setValue({
      ...data,
      password: "á".repeat(37),
      confirmPassword: "á".repeat(37),
    });
    page.submit();
    expect(page.form.controls.password.hasError("passwordBytes")).toBe(true);
    expect(register).not.toHaveBeenCalled();
  });
  it("suggests the same username format as the administrator and respects manual edits", () => {
    const { page } = setup();
    page.form.controls.name.setValue("María");
    page.form.controls.lastname.setValue("Pérez");
    expect(page.form.controls.username.value).toBe("mariaperez");
    page.form.controls.username.markAsDirty();
    page.form.controls.username.setValue("maria");
    page.form.controls.lastname.setValue("Gómez");
    expect(page.form.controls.username.value).toBe("maria");
  });
  it("shows the backend duplicate error and lets the customer correct their data", () => {
    const { page, response, navigate } = setup();
    page.form.setValue(data);
    page.submit();
    response.error(
      new HttpErrorResponse({
        status: 400,
        error: { detail: "El correo ya está registrado." },
      }),
    );
    expect(page.error()).toBe("El correo ya está registrado.");
    expect(page.busy()).toBe(false);
    expect(page.form.controls.email.value).toBe(data.email);
    expect(navigate).not.toHaveBeenCalled();
  });
});
