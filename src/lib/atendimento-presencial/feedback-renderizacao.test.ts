import { afterEach, expect, it, vi } from 'vitest'
import { aguardarPinturaFeedback } from './feedback-renderizacao'

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

it('não inicia trabalho síncrono no frame reservado à pintura do feedback', async () => {
  vi.useFakeTimers()
  let frame: FrameRequestCallback | undefined
  vi.stubGlobal('window', { requestAnimationFrame: (callback: FrameRequestCallback) => { frame = callback }, setTimeout })
  const trabalho = vi.fn()
  const conclusao = aguardarPinturaFeedback().then(trabalho)
  await Promise.resolve()
  expect(trabalho).not.toHaveBeenCalled()
  frame!(0)
  await Promise.resolve()
  expect(trabalho).not.toHaveBeenCalled()
  await vi.runAllTimersAsync()
  await conclusao
  expect(trabalho).toHaveBeenCalledTimes(1)
})
