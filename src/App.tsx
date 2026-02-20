import './App.css'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AddCard from './pages/AddCard'
import CardRequest from './pages/CardRequest'
import RequestConfirmation from './pages/RequestConfirmation'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/add-card" replace />} />
        <Route path="/add-card" element={<AddCard />} />
        <Route path="/card-request" element={<CardRequest />} />
        <Route path="/request-confirmation" element={<RequestConfirmation />} />
      </Routes>
    </Layout>
  )
}

export default App

