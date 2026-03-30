import './globals.css'

export const metadata = {
  title: 'Conferentie Planner',
  description: 'Professionele conferentie planner met Supabase cloud opslag',
  manifest: '/manifest.json',
  icons: {
    icon: '/icon-512.png',
    apple: '/icon-512.png',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }) {
  return (
    <html lang="nl">
      <head>
        <script
          src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
          async
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
