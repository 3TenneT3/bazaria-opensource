// Genera los stickers del skin Doodle con la API de imágenes de OpenAI.
// Uso: node --env-file=.env scripts/generar-imagenes.mjs   (la llave no entra al bundle)
import { writeFile } from 'node:fs/promises'

const estilo =
  'hand-drawn doodle sticker, thick indigo-blue (#4a47c4) outline, flat pastel fills, kawaii Y2K bubbly style, fashion bazaar theme, transparent background, no text, centered'
const items = {
  mascota: 'cute flower-shaped character with a purple petal head, round glasses, holding shopping bags and a mint backpack, standing on white sneakers',
  carita1: 'happy smiley face with star eyes and a blue outline',
  carita2: 'smiley face sticking tongue out, winking',
  carita3: 'smiley face with heart eyes',
  flor: 'small swirl daisy flower with spiral center',
  nota: 'yellow sticky note with a paper clip, slightly rotated, empty (no writing)',
  pinceles: 'two paint brushes crossed with a small blue paint tube',
  perchero: 'clothes rack with three hanging garments, pastel colors',
}
for (const [nombre, desc] of Object.entries(items)) {
  const r = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: 'gpt-image-1', prompt: `${desc}. ${estilo}`, size: '1024x1024',
      quality: 'low', background: 'transparent', output_format: 'png',
    }),
  })
  const j = await r.json()
  if (!r.ok) { console.error(nombre, r.status, j.error?.message); continue }
  await writeFile(`public/doodle/${nombre}.png`, Buffer.from(j.data[0].b64_json, 'base64'))
  console.log('ok', nombre)
}
