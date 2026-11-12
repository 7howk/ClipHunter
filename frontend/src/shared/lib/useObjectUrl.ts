import { useEffect, useState } from 'react';

/**
 * blob-URL для файла, который освобождается при смене файла и размонтировании.
 * URL создаётся в эффекте, поэтому повторный mount в StrictMode получает новый
 * рабочий URL, а не уже отозванный.
 */
export function useObjectUrl(blob: Blob | null): string | null {
  const [entry, setEntry] = useState<{ blob: Blob; url: string } | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    // Синхронизация с внешним ресурсом браузера: URL нельзя получить при рендере без утечки
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntry({ blob, url });
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  return entry && entry.blob === blob ? entry.url : null;
}
