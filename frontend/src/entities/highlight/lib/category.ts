import type { HighlightCategory } from '@/shared/api';

export const CATEGORY_LABELS: Record<HighlightCategory, string> = {
  funny: 'Юмор',
  emotional: 'Эмоции',
  surprise: 'Неожиданность',
  conflict: 'Конфликт',
  tension: 'Напряжение',
  climax: 'Кульминация',
  reaction: 'Реакция',
};

export function getCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category as HighlightCategory] ?? category;
}
