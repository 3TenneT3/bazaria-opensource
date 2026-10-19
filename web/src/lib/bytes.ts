/** Bytes en texto corto: "3.2 MB", "850 MB", "1.5 GB". */
export function mb(bytes: number): string {
  const v = bytes / (1024 * 1024)
  return v >= 1000 ? `${(v / 1024).toFixed(1)} GB` : `${v < 10 ? v.toFixed(1) : Math.round(v)} MB`
}
