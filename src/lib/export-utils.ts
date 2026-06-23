function escapeCSV(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `"${value}"`;
}

export function buildCSV(headers: string[], rows: string[][]): string {
  const BOM = '﻿';
  const headerLine = headers.map(escapeCSV).join(',');
  const dataLines = rows.map(r => r.map(escapeCSV).join(','));
  return BOM + [headerLine, ...dataLines].join('\n');
}

export function downloadCSV(filename: string, headers: string[], rows: string[][]): void {
  const csv = buildCSV(headers, rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildClipboardText(headers: string[], rows: string[][]): string {
  const headerLine = headers.join('\t');
  const dataLines = rows.map(r => r.join('\t'));
  return [headerLine, ...dataLines].join('\n');
}

export async function copyTableToClipboard(headers: string[], rows: string[][]): Promise<void> {
  const text = buildClipboardText(headers, rows);
  await navigator.clipboard.writeText(text);
}
