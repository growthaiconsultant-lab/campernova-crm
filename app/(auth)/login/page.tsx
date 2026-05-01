import { LoginForm } from './login-form'

interface LoginPageProps {
  searchParams: { error?: string }
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const callbackError =
    searchParams.error === 'callback'
      ? 'El enlace ha expirado o ya fue usado. Solicita uno nuevo.'
      : undefined

  return <LoginForm callbackError={callbackError} />
}
