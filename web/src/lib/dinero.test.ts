import { describe, it, expect } from 'vitest'
import { centavosDesdeTecleo, formatoCaptura } from './dinero'

describe('captura estilo banco', () => {
  it('teclear 5, 5, 5 da 0.05, 0.55 y 5.55', () => {
    let texto = formatoCaptura(0) // "0.00"
    const pasos: number[] = []
    for (const tecla of ['5', '5', '5']) {
      texto = formatoCaptura(centavosDesdeTecleo(texto + tecla))
      pasos.push(centavosDesdeTecleo(texto))
    }
    expect(pasos).toEqual([5, 55, 555])
    expect(texto).toBe('5.55')
  })

  it('borrar quita el último dígito', () => {
    expect(centavosDesdeTecleo('5.5')).toBe(55) // "5.55" menos el último carácter
    expect(centavosDesdeTecleo('0.0')).toBe(0)
  })

  it('ignora lo que no sea dígito y respeta el tope', () => {
    expect(centavosDesdeTecleo('$1,234.56')).toBe(123456)
    expect(centavosDesdeTecleo('999999999999999')).toBe(9_999_999_999)
    expect(formatoCaptura(123456)).toBe('1,234.56')
  })
})
