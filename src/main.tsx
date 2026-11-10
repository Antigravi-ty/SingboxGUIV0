import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/primer.css'
import './styles/layout.css'
import './styles/controls.css'
import './styles/tables-and-modals.css'
import './styles/markdown.css'

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
