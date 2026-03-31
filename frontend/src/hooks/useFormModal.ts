import { useState, useCallback } from 'react';

interface UseFormModalOptions<T> {
  initialValues: T;
}

interface UseFormModalReturn<T> {
  form: T;
  setForm: React.Dispatch<React.SetStateAction<T>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  saving: boolean;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  error: string;
  setError: React.Dispatch<React.SetStateAction<string>>;
  reset: () => void;
}

export function useFormModal<T>({ initialValues }: UseFormModalOptions<T>): UseFormModalReturn<T> {
  const [form, setForm] = useState<T>(initialValues);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setForm(prev => ({ ...prev, [field]: value }));
  }, []);

  const reset = useCallback(() => {
    setForm(initialValues);
    setSaving(false);
    setError('');
  }, [initialValues]);

  return { form, setForm, updateField, saving, setSaving, error, setError, reset };
}
