import { TestBed } from "@angular/core/testing";
import { provideRouter, ActivatedRoute } from "@angular/router";
import { of, Subject } from "rxjs";
import { PaymentPage, validTestCard } from "./payment-page";
import { Purchases } from "./store";
import { Order } from "./models";
const pending: Order = {
  idProductsSold: 25,
  idUser: 2,
  createDate: "2026-10-23",
  stateSold: { idStateSold: 1, nameState: "PENDIENTE" },
  totalAmount: 37.5,
  products: [],
};
function setup() {
  const response = new Subject<unknown>();
  const get = vi.fn(() => of(pending));
  const pay = vi.fn(() => response);
  TestBed.configureTestingModule({
    imports: [PaymentPage],
    providers: [
      provideRouter([]),
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { paramMap: new Map([["id", "25"]]) } },
      },
      { provide: Purchases, useValue: { get, pay } },
    ],
  });
  const fixture = TestBed.createComponent(PaymentPage);
  fixture.detectChanges();
  return { fixture, page: fixture.componentInstance, pay, get, response };
}
describe("Simulated Visa payment", () => {
  it("accepts only the documented test card, expiry and CVV", () => {
    expect(validTestCard("4242 4242 4242 4242", "12/30", "123")).toBe(true);
    for (const data of [
      ["4111111111111111", "12/30", "123"],
      ["4242424242424242", "11/30", "123"],
      ["4242424242424242", "12/30", "999"],
    ])
      expect(validTestCard(...(data as [string, string, string]))).toBe(false);
  });
  it.each([
    ["Kimberly Hughes", "4110933720438861", "07/34", "109"],
    ["Paul Miller", "4732455816820933", "08/32", "511"],
    ["Steven Diaz", "4110934170668882", "03/34", "410"],
    ["Ronald Peterson", "4698943648512234", "04/32", "973"],
    ["Mark Kelly", "4222244196868168", "11/29", "110"],
  ])(
    "accepts the configured card for %s without transmitting its details",
    (holder, number, expiry, cvv) => {
      const { page, pay } = setup();
      page.form.setValue({
        holder: "  " + holder.toUpperCase() + "  ",
        number,
        expiry,
        cvv,
      });
      page.pay();
      expect(pay).toHaveBeenCalledExactlyOnceWith(25, 37.5);
    },
  );
  it("rejects mismatched holders, CVVs and expiry dates without requesting a charge", () => {
    const { page, pay } = setup();
    const card = {
      holder: "Kimberly Hughes",
      number: "4110933720438861",
      expiry: "07/34",
      cvv: "109",
    };
    for (const invalid of [
      { ...card, holder: "Paul Miller" },
      { ...card, expiry: "08/32" },
      { ...card, cvv: "511" },
    ]) {
      page.form.setValue(invalid);
      page.pay();
    }
    expect(pay).not.toHaveBeenCalled();
    expect(page.cardError()).toBe("Revisa los datos de la tarjeta.");
  });
  it("updates both card faces from the fields and flips only while CVV has focus", () => {
    const { fixture, page } = setup();
    const element: HTMLElement = fixture.nativeElement;
    expect(
      element.querySelector(".card-number-preview")?.textContent,
    ).not.toContain("4242");
    const fill = (id: string, value: string) => {
      const input = element.querySelector<HTMLInputElement>(id)!;
      input.value = value;
      input.dispatchEvent(new Event("input"));
      fixture.detectChanges();
    };
    fill("#card-holder", "Elena2 Soto");
    expect(page.form.controls.holder.value).toBe("Elena Soto");
    expect(
      element.querySelector(".card-holder-preview")?.textContent,
    ).toContain("Elena Soto");
    fill("#card-number", "42424242");
    expect(
      element.querySelector(".card-number-preview")?.textContent,
    ).toContain("4242 4242 •••• ••••");
    fill("#card-expiry", "1230");
    expect(
      element.querySelector(".card-expiry-preview")?.textContent,
    ).toContain("12/30");
    const cvv = element.querySelector<HTMLInputElement>("#card-cvv")!;
    cvv.dispatchEvent(new FocusEvent("focus"));
    fixture.detectChanges();
    expect(
      element
        .querySelector(".card-rotator")
        ?.classList.contains("card-flipped"),
    ).toBe(true);
    fill("#card-cvv", "123");
    expect(
      element.querySelector(".card-signature strong")?.textContent,
    ).toContain("123");
    cvv.dispatchEvent(new FocusEvent("blur"));
    fixture.detectChanges();
    expect(
      element
        .querySelector(".card-rotator")
        ?.classList.contains("card-flipped"),
    ).toBe(false);
  });
  it("never submits invalid cards and prevents duplicate clicks", () => {
    const { page, pay, response, get } = setup();
    page.pay();
    expect(pay).not.toHaveBeenCalled();
    page.form.setValue({
      holder: "Elena Soto",
      number: "4242 4242 4242 4242",
      expiry: "12/30",
      cvv: "123",
    });
    page.pay();
    page.pay();
    expect(pay).toHaveBeenCalledTimes(1);
    expect(pay).toHaveBeenCalledWith(25, 37.5);
    get.mockReturnValue(
      of({ ...pending, stateSold: { idStateSold: 2, nameState: "PAGADO" } }),
    );
    response.next({});
    response.complete();
    expect(page.order()?.stateSold.nameState).toBe("PAGADO");
    expect(page.form.controls.cvv.value).toBe("");
    page.pay();
    expect(pay).toHaveBeenCalledTimes(1);
  });
});
