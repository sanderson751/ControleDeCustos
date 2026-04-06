import { User } from 'firebase/auth'

type WelcomeCenterProps = {
  user: User
}

function WelcomeCenter({ user }: WelcomeCenterProps) {
  const userName = user.displayName || user.email || 'Usuario'

  return (
    <section className="welcome-center container-fluid py-4" data-testid="main-app-screen">
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9 col-xl-8">
          <div className="card border-0 shadow-sm">
            <div className="card-body p-4 p-md-5 text-center">
              <p className="text-uppercase text-muted fw-semibold mb-2">Boas-vindas</p>
              <h2 className="display-6 mb-3">Ola, {userName}</h2>
              <p className="lead mb-2">Seu dashboard de custos do mes corrente sera exibido aqui.</p>
              <p className="text-muted mb-0">
                Use o menu lateral e a appbar global para navegar e gerenciar sua sessao.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default WelcomeCenter
