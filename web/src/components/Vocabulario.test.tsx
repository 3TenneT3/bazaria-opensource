import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { VocabularioProvider, useVocabulario } from './Vocabulario'

function Prueba() {
  const { modo, setModo, t } = useVocabulario()
  return (
    <>
      <p data-testid="titulo">{t.agregaUnItem}</p>
      <p data-testid="guardado">{t.itemGuardado}</p>
      <button onClick={() => setModo(modo === 'ropa' ? 'general' : 'ropa')}>cambiar</button>
    </>
  )
}

describe('Vocabulario', () => {
  beforeEach(() => localStorage.clear())

  it('arranca en ropa y cambia a neutro con concordancia de género', () => {
    render(
      <VocabularioProvider>
        <Prueba />
      </VocabularioProvider>,
    )
    expect(screen.getByTestId('titulo')).toHaveTextContent('Agrega una prenda')
    fireEvent.click(screen.getByText('cambiar'))
    expect(screen.getByTestId('titulo')).toHaveTextContent('Agrega un artículo')
    expect(screen.getByTestId('guardado')).toHaveTextContent('¡Artículo guardado!')
    expect(localStorage.getItem('bazaria-vocabulario')).toBe('general')
  })

  it('recuerda el modo elegido', () => {
    localStorage.setItem('bazaria-vocabulario', 'general')
    render(
      <VocabularioProvider>
        <Prueba />
      </VocabularioProvider>,
    )
    expect(screen.getByTestId('titulo')).toHaveTextContent('Agrega un artículo')
  })
})
