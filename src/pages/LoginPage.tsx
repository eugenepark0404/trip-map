import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSubmitting(false)
    if (error) {
      console.error('login error', error)
      setError('이메일 또는 비밀번호를 확인해주세요.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-xl font-medium text-ink">로그인</h1>
      <p className="mb-8 text-sm text-muted">지도에 기록을 이어서 남겨보세요.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {error && <p className="text-sm text-accent">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="mt-2 rounded-sm bg-accent px-3 py-2 text-sm font-medium text-accent-ink disabled:opacity-50"
        >
          로그인
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        계정이 없다면{' '}
        <Link to="/signup" className="text-ink underline underline-offset-2">
          회원가입
        </Link>
      </p>
    </div>
  )
}
