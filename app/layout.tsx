import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'AgentGate — Human-in-the-Loop Approval Inbox',
  description: 'Framework-agnostic real-time approval inbox for AI agents',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="bg-gray-950 text-gray-100 min-h-full antialiased">
        {children}
      </body>
    </html>
  )
}
