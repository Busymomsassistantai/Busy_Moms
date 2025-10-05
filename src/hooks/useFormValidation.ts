import { useState, useCallback } from 'react';
import { z, ZodError, ZodSchema } from 'zod';
import { FormErrors } from '../lib/errors/types';

interface UseFormValidationReturn<T> {
  values: T;
  errors: FormErrors;
  touched: Record<string, boolean>;
  isValid: boolean;
  isValidating: boolean;
  handleChange: (name: string, value: any) => void;
  handleBlur: (name: string) => void;
  handleSubmit: (onSubmit: (values: T) => void | Promise<void>) => (e?: React.FormEvent) => Promise<void>;
  setFieldError: (name: string, error: string) => void;
  setFieldValue: (name: string, value: any) => void;
  setErrors: (errors: FormErrors) => void;
  clearErrors: () => void;
  resetForm: () => void;
  validateField: (name: string) => Promise<boolean>;
  validateForm: () => Promise<boolean>;
}

interface UseFormValidationOptions<T> {
  initialValues: T;
  validationSchema?: ZodSchema;
  onSubmit?: (values: T) => void | Promise<void>;
  validateOnChange?: boolean;
  validateOnBlur?: boolean;
}

export function useFormValidation<T extends Record<string, any>>({
  initialValues,
  validationSchema,
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}: UseFormValidationOptions<T>): UseFormValidationReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValidating, setIsValidating] = useState(false);

  const validateField = useCallback(
    async (name: string): Promise<boolean> => {
      if (!validationSchema) return true;

      try {
        const fieldSchema = (validationSchema as any).shape?.[name];
        if (!fieldSchema) return true;

        await fieldSchema.parseAsync(values[name]);
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[name];
          return newErrors;
        });
        return true;
      } catch (error) {
        if (error instanceof ZodError) {
          const fieldError = error.errors[0]?.message || 'Invalid value';
          setErrors((prev) => ({ ...prev, [name]: fieldError }));
        }
        return false;
      }
    },
    [validationSchema, values]
  );

  const validateForm = useCallback(async (): Promise<boolean> => {
    if (!validationSchema) return true;

    setIsValidating(true);
    try {
      await validationSchema.parseAsync(values);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof ZodError) {
        const formErrors: FormErrors = {};
        error.errors.forEach((err) => {
          if (err.path.length > 0) {
            const fieldName = err.path[0] as string;
            formErrors[fieldName] = err.message;
          }
        });
        setErrors(formErrors);
      }
      return false;
    } finally {
      setIsValidating(false);
    }
  }, [validationSchema, values]);

  const handleChange = useCallback(
    (name: string, value: any) => {
      setValues((prev) => ({ ...prev, [name]: value }));

      if (validateOnChange && touched[name]) {
        setTimeout(() => {
          validateField(name);
        }, 0);
      }
    },
    [validateOnChange, touched, validateField]
  );

  const handleBlur = useCallback(
    (name: string) => {
      setTouched((prev) => ({ ...prev, [name]: true }));

      if (validateOnBlur) {
        validateField(name);
      }
    },
    [validateOnBlur, validateField]
  );

  const handleSubmit = useCallback(
    (submitHandler: (values: T) => void | Promise<void>) =>
      async (e?: React.FormEvent) => {
        if (e) {
          e.preventDefault();
        }

        const allTouched: Record<string, boolean> = {};
        Object.keys(values).forEach((key) => {
          allTouched[key] = true;
        });
        setTouched(allTouched);

        const isValid = await validateForm();

        if (isValid) {
          await submitHandler(values);
        }
      },
    [values, validateForm]
  );

  const setFieldError = useCallback((name: string, error: string) => {
    setErrors((prev) => ({ ...prev, [name]: error }));
  }, []);

  const setFieldValue = useCallback((name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
  }, []);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  const isValid = Object.keys(errors).length === 0;

  return {
    values,
    errors,
    touched,
    isValid,
    isValidating,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldError,
    setFieldValue,
    setErrors,
    clearErrors,
    resetForm,
    validateField,
    validateForm,
  };
}

export function getFieldError(
  errors: FormErrors,
  touched: Record<string, boolean>,
  fieldName: string
): string | undefined {
  if (!touched[fieldName]) return undefined;
  const error = errors[fieldName];
  return typeof error === 'string' ? error : undefined;
}

export function hasFieldError(
  errors: FormErrors,
  touched: Record<string, boolean>,
  fieldName: string
): boolean {
  return touched[fieldName] && !!errors[fieldName];
}
