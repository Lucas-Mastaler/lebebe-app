'use client'

import { useEffect, useRef, type CSSProperties } from 'react'
import { Dialog, DialogContent, DialogHeader, Button } from '@/components/design-system'
import { BrandLogo } from '@/components/BrandLogo'
import { META_PV } from '@/lib/atendimento-presencial/produtos'
import type { DadosComemoracaoPv } from './useComemoracaoPv'
import styles from './ComemoracaoPv.module.css'

export const DURACAO_COMEMORACAO_PV_MS = 5000
const FOGOS = [
  { left: '12%', top: '27%', delay: '0s', color: '#49d9ff' },
  { left: '83%', top: '20%', delay: '0.35s', color: '#ffe777' },
  { left: '30%', top: '16%', delay: '0.7s', color: '#ff86c1' },
  { left: '70%', top: '39%', delay: '1.05s', color: '#77ecbd' },
  { left: '48%', top: '11%', delay: '1.4s', color: '#b7a0ff' },
  { left: '90%', top: '56%', delay: '1.75s', color: '#49d9ff' },
]
const PARTICULAS = Array.from({ length: 20 }, (_, index) => {
  const angle = index / 20 * Math.PI * 2
  const distance = index % 2 === 0 ? 112 : 82
  return { x: `${Math.round(Math.cos(angle) * distance)}px`, y: `${Math.round(Math.sin(angle) * distance)}px`, size: index % 4 === 0 ? '7px' : '5px', angle: `${Math.round(index / 20 * 360 + 90)}deg` }
})

export function ComemoracaoPv({ dados, onFechar }: { dados: DadosComemoracaoPv; onFechar: () => void }) {
  const fechar = useRef(onFechar)
  useEffect(() => { fechar.current = onFechar }, [onFechar])
  useEffect(() => {
    const timer = setTimeout(() => fechar.current(), DURACAO_COMEMORACAO_PV_MS)
    return () => clearTimeout(timer)
  }, [dados.atendimentoId])

  return <Dialog open onOpenChange={aberto => { if (!aberto) onFechar() }}>
    <DialogContent className={`${styles.scene} left-0 top-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0 rounded-none border-0 data-[state=open]:animate-none`}>
      <div className={styles.sky} aria-hidden="true" />
      <div className={styles.fireworks} aria-hidden="true">
        {FOGOS.map((fogo, index) => <div className={styles.firework} key={index} style={{ '--left': fogo.left, '--top': fogo.top, '--delay': fogo.delay, '--color': fogo.color } as CSSProperties}>
          <span className={styles.rocket} /><span className={styles.flash} />
          {PARTICULAS.map((particula, indice) => <span className={styles.particle} key={indice} style={{ '--x': particula.x, '--y': particula.y, '--size': particula.size, '--angle': particula.angle } as CSSProperties} />)}
        </div>)}
      </div>
      <div className={styles.content}>
        <span className={styles.eyebrow}>VENDA FECHADA · {dados.pv} PEÇAS</span>
        <div className={styles.marca}><BrandLogo className="w-full" sizes="188px" /></div>
        <DialogHeader
          className={styles.header}
          titleClassName={styles.titulo}
          title={<>Parabéns,<br /><span>PV batido!</span></>}
          description={`Você fechou a venda com ${dados.pv} peças. ${Math.round(dados.pv / META_PV * 100)}% da referência de ${META_PV}.`}
        />
        <Button type="button" className={styles.continuar} onClick={onFechar}>Continuar</Button>
        <p className={styles.aviso}>Atendimento salvo. Esta mensagem fecha automaticamente.</p>
      </div>
      <span className={styles.bottomGlow} aria-hidden="true" />
    </DialogContent>
  </Dialog>
}
