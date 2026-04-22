import { AxiosError } from 'axios';

export function formatAxiosError(error: AxiosError) {
  const responseData = error.response?.data as
    | {
        message?: string;
        validation_errors?: string[];
      }
    | undefined;

  return {
    name: error.name,
    stack: error.stack,
    cause: error.cause,
    message: error.message,
    responseMessage:
      typeof responseData?.message === 'string'
        ? responseData.message
        : undefined,
    validationErrors: Array.isArray(responseData?.validation_errors)
      ? responseData.validation_errors
      : undefined,
  };
}
