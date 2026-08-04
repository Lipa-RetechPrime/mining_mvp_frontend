export type FieldErrors = Readonly<Record<string, readonly string[]>>;

export interface ApiErrorDetails {
  message: string;
  status: number;
  fieldErrors?: FieldErrors;
}

export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors?: FieldErrors;

  constructor({ message, status, fieldErrors }: ApiErrorDetails) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
