/**
 * Shared formatting utilities — единая точка для форматирования данных.
 * Заменяет дублирование formatCurrency в 7+ файлах.
 */

const currencyFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
})

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatCurrency = (amount: number): string =>
  currencyFormatter.format(amount)

export const formatNumber = (value: number): string =>
  numberFormatter.format(value)

export const formatDate = (date: string | Date): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('ru-RU')
}

/** Метки категорий компонентов */
export const CATEGORY_LABELS: Record<string, string> = {
  reagent: 'Реактивы',
  metal: 'Металл',
  equipment: 'Оборудование',
  print: 'Полиграфия',
  labor: 'Работа',
}
