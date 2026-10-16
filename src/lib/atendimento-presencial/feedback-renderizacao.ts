/** Entrega um frame ao navegador antes de validações, cache e autosave síncronos.
 * O timer dentro do frame deixa a pintura ocorrer antes da continuação async.
 */
export function aguardarPinturaFeedback(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => { window.setTimeout(resolve, 0) })
  })
}
