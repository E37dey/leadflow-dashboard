import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource-variable/heebo'
import './styles/tokens.css'
import './styles/app.css'
import App from './App'
import { StoreProvider } from './store/store'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
)
