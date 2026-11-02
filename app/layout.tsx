// RP MotionStudio edition: modifications by Rafael Posada (2026). See NOTICE.
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/tokens.css';
import './globals.css';
import './workspace.css';
import {professionalIdentity} from '@/lib/publicIdentity';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'RP MotionStudio',
  applicationName: 'RP MotionStudio',
  description: 'RP MotionStudio — editor local de composição e animação. Versão RP desenvolvida por Rafael Posada, brand designer. Fotos, vídeos, texto e áudio.',
  authors:[{name:'Rafael Posada',url:'https://rafaelposada.com'}],
  creator:'Rafael Posada',publisher:'Rafael Posada',
  keywords:['RP MotionStudio','Rafael Posada','brand designer','branding','motion design','composição','animação'],
  appleWebApp: { capable: true, title: 'RP MotionStudio' },
  icons: {
    icon: [{ url: '/rp-motionstudio.svg', type: 'image/svg+xml', sizes: 'any' }],
    apple: [{ url: '/apple-touch-icon.png?v=rp-svg', sizes: '1024x1024' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(professionalIdentity).replace(/</g,'\\u003c')}}/>
        <meta name="theme-color" content="#0c0d0f" />
        <script dangerouslySetInnerHTML={{ __html: `
          try {
            const saved = JSON.parse(localStorage.getItem('motion-ui-preferences') || '{}') || {};
            const theme = saved.appearance === 'system' || !saved.theme ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : saved.theme === 'dark' ? 'dark' : 'light';
            document.documentElement.dataset.theme = theme;
            document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0c0d0f' : '#eef1f5');
            document.documentElement.lang = saved.locale === 'pt' ? 'pt-BR' : 'en';
          } catch (_) {}
        ` }} />
        {/* Share Tech Mono — glyph set used by the 3D ASCII effect */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap" rel="stylesheet" />
      </head>
      <body className={inter.variable}>{children}</body>
    </html>
  );
}
