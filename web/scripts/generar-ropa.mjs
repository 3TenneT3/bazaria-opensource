// Genera las 25 fotos de prendas del seed (public/demo/prenda-NN-tipo.png).
// Uso: node --env-file=.env scripts/generar-ropa.mjs
import { writeFile } from 'node:fs/promises'
const tipos = {
  blusa: 'women\'s blouse', pantalon: 'women\'s high-waisted jeans', vestido: 'women\'s casual dress',
  falda: 'women\'s skirt', chamarra: 'women\'s denim or bomber jacket',
}
const colores = ['pastel lavender', 'mint green', 'washed light blue', 'cream white with small print', 'dusty pink']
const orden = Object.keys(tipos)
for (let n = 1; n <= 25; n++) {
  const tipo = orden[(n - 1) % 5], color = colores[Math.floor((n - 1) / 5)]
  const prompt = `Product photo of a second-hand ${color} ${tipos[tipo]} laid flat or on a hanger, soft natural light, clean light pastel background, e-commerce thrift store style, realistic, no text, no people, centered`
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1024x1024', quality: 'low', output_format: 'png' }),
  })
  const j = await r.json()
  if (!r.ok) { console.error(n, r.status, j.error?.message); continue }
  await writeFile(`public/demo/prenda-${String(n).padStart(2, '0')}-${tipo}.png`, Buffer.from(j.data[0].b64_json, 'base64'))
  console.log('ok', n, tipo)
}
