import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="container py-4">
      <h1 className="text-center mb-4">Controle de Custos</h1>

      <div className="row justify-content-center">
        <div className="col-12 col-md-6">
          <div className="card shadow-sm">
            <div className="card-body text-center">
              <p className="card-text fs-5">
                Contador: <strong data-testid="counter-value">{count}</strong>
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setCount((c) => c + 1)}
              >
                Incrementar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
