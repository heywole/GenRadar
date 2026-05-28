import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { ThemeProvider }  from '@/components/ThemeProvider'
import { Navbar }         from '@/components/Navbar'
import { Sidebar }        from '@/components/Sidebar'
import { Footer }         from '@/components/Footer'
import './globals.css'

export const metadata: Metadata = {
  title: 'GenScout',
  description: 'Community-driven discovery platform for GenLayer ecosystem projects. AI-evaluated. Community-rated.',
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: '/favicon.svg',
    apple: '/favicon.svg',
  },
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <Navbar session={session} />
          <div style={{ marginTop: 64, display: 'flex', minHeight: 'calc(100vh - 64px)' }}>
            <div className="sidebar-desktop">
              <Sidebar session={session} />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
              <main style={{ flex: 1 }}>{children}</main>
              <Footer />
            </div>
          </div>
        </ThemeProvider>
      </body>
    </html>
  )
}
