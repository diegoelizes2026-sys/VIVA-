import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'VIVA+ | Sua vida mais inteligente',description:'Organize sua rotina, cuide do seu dinheiro e economize.',manifest:'/manifest.webmanifest',themeColor:'#7028D8'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body>{children}</body></html>}
