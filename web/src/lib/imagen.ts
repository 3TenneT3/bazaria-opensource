/**
 * Comprime una imagen en el cliente antes de cualquier uso:
 * máximo 1280px en el lado largo, WebP calidad 80, corrige orientación EXIF
 * (el navegador ya corrige EXIF automáticamente al dibujar en <canvas> vía
 * createImageBitmap con imageOrientation: 'from-image').
 */
export async function comprimirImagen(archivo: Blob): Promise<Blob> {
  const MAX_LADO = 1280
  const CALIDAD = 0.8

  const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' })

  let { width, height } = bitmap
  if (width > MAX_LADO || height > MAX_LADO) {
    if (width > height) {
      height = Math.round((height * MAX_LADO) / width)
      width = MAX_LADO
    } else {
      width = Math.round((width * MAX_LADO) / height)
      height = MAX_LADO
    }
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No se pudo obtener el contexto de canvas')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('No se pudo comprimir la imagen'))
      },
      'image/webp',
      CALIDAD,
    )
  })
}
