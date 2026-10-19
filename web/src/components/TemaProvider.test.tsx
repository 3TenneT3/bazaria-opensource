import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { TemaProvider, useTema } from './TemaProvider'

function BotonPrueba() {
  const { tema, alternarTema } = useTema()
  return (
    <button onClick={alternarTema} data-testid="boton">
      {tema}
    </button>
  )
}

describe('TemaProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('arranca en claro por defecto y alterna a oscuro al hacer click', () => {
    render(
      <TemaProvider>
        <BotonPrueba />
      </TemaProvider>,
    )
    const boton = screen.getByTestId('boton')
    expect(boton).toHaveTextContent('claro')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    fireEvent.click(boton)
    expect(boton).toHaveTextContent('oscuro')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    fireEvent.click(boton)
    expect(boton).toHaveTextContent('claro')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persiste el tema elegido en localStorage', () => {
    render(
      <TemaProvider>
        <BotonPrueba />
      </TemaProvider>,
    )
    fireEvent.click(screen.getByTestId('boton'))
    expect(localStorage.getItem('bazar_tema')).toBe('oscuro')
  })
})
