export type { User } from "./contracts/users.js";
export type { Invoice } from "./contracts/invoices.js";

export interface LoginCredentials {
  email: string;
  password: string;
}
