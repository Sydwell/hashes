//import '@/styles/globals.css'
import 'bootstrap/dist/css/bootstrap.css'
import '@/styles/bquest.css'
import type { AppProps } from 'next/app'
// import * from "https://unpkg.com/@bitjson/qr-code@1.0.2/dist/qr-code.js"

export default function App({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}
