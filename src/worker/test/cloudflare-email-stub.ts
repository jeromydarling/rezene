/**
 * Node-side stand-in for the Workers-only `cloudflare:email` module so vitest
 * can import files that use it. Tests never send mail; they only touch the
 * pure helpers exported alongside.
 */
export class EmailMessage {
  constructor(
    public from: string,
    public to: string,
    public raw: string,
  ) {}
}
