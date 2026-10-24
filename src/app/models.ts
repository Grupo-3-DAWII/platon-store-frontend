export interface Page<T> {
  content: T[];
  page: number;
  totalPages: number;
  last: boolean;
}
export interface Product {
  idProduct: number;
  name: string;
  author: string;
  genre: string;
  editorial: string;
  image: string | null;
  salePrice: number;
  stock: number;
  active: boolean;
  available: boolean;
  isbn?: string;
  description?: string;
  publicationYear?: number;
}
export interface Account {
  idUser: number;
  username: string;
  name: string;
  lastname: string;
  role: string;
  status: string;
  email?: string;
  nro?: string;
  direccion?: string;
}
export interface Session {
  token: string;
  expiresAt: number;
  user: Account;
}
export interface CartEntry {
  productId: number;
  quantity: number;
}
export interface Order {
  idProductsSold: number;
  idUser: number;
  createDate: string;
  stateSold: { idStateSold: number; nameState: string };
  totalAmount: number | null;
  orderStatus?: string;
  paymentMethod?: string | null;
  paidAt?: string | null;
  paymentReference?: string | null;
  products: {
    idProducts: number;
    numberSold: number;
    unitPrice: number | null;
    subtotal: number | null;
    product: { name: string } | null;
  }[];
}
export const COVER = "/images/placeholder/book-cover.png";
export const money = (value: number) => Math.round(value * 100) / 100;
export const statusLabel = (value: string) =>
  ({
    PENDIENTE: "Pendiente de pago",
    PAGADO: "Pagado",
    CANCELADO: "Cancelado",
  })[value.toUpperCase()] ?? value;
