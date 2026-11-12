import type { ReactNode } from 'react'
import Image from 'next/image'
import styles from './public-page-intro.module.css'

type Props = {
  label: string
  title: string
  accent?: string
  description: string
  photo: string
  compact?: boolean
  children?: ReactNode
}

export function PublicPageIntro({
  label,
  title,
  accent,
  description,
  photo,
  compact,
  children,
}: Props) {
  return (
    <header className={compact ? `${styles.hero} ${styles.compact}` : styles.hero}>
      <div className={styles.photo}>
        <Image src={photo} alt="" fill sizes="(max-width: 700px) 100vw, 58vw" priority />
      </div>
      <div className={styles.inner}>
        <p className={styles.label}>{label}</p>
        <h1>
          {title}
          {accent && (
            <>
              {' '}
              <em>{accent}</em>
            </>
          )}
        </h1>
        <p className={styles.description}>{description}</p>
        {children && <div className={styles.actions}>{children}</div>}
      </div>
    </header>
  )
}
