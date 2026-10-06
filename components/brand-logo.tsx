import { Glasses } from 'lucide-react'

export function BrandLogo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <div className={`brand-lockup logo-${size}`}>
      <div className="brand-mark"><Glasses /></div>
      <p className="logo-word"><span className="logo-a">Chasma</span><span className="logo-b">Ghar</span></p>
    </div>
  )
}
