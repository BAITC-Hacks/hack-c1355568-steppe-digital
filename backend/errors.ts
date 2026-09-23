export class AppError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "AppError"; }
}
export function publicError(error: unknown): string {
  return error instanceof AppError ? error.message : "Не удалось выполнить операцию. Повторите попытку.";
}
