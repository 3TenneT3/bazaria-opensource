import { describe, it, expect } from 'vitest'
import { DemoDataSource } from './DemoDataSource'

describe('DemoDataSource', () => {
  it('no duplica la semilla cuando varias pantallas piden datos al mismo tiempo', async () => {
    const a = new DemoDataSource()
    const b = new DemoDataSource()
    await Promise.all([a.listarLotes(), b.listarLotes(), a.listarLotes()])
    expect(await a.listarLotes()).toHaveLength(2)
  })
})
