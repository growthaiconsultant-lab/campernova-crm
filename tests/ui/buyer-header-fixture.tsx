import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Topbar } from '../../components/layout/topbar'
import { BuyerTopbarActions } from '../../app/(backoffice)/compradores/[id]/buyer-topbar-actions'

function Fixture() {
  const [detail, setDetail] = useState(false)
  function openDetail() {
    history.pushState(null, '', '/compradores/buyer-qa?tab=documentos')
    setDetail(true)
  }
  return (
    <div className="crm-theme">
      <Topbar
        userName="Agente QA"
        userEmail="agente@example.test"
        userRole="Agente"
        leading={<button aria-label="Abrir menú">Menú</button>}
      />
      {detail ? (
        <BuyerTopbarActions leadId="buyer-qa" isTerminal={false}>
          <p>Origen · Formulario web</p>
        </BuyerTopbarActions>
      ) : (
        <button onClick={openDetail}>Abrir comprador de prueba</button>
      )}
    </div>
  )
}
createRoot(document.getElementById('root')!).render(<Fixture />)
