import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function SignupPage() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    setSubmitting(false)
    if (error) {
      console.error('signup error', error)
      setError('가입에 실패했습니다. 이메일과 비밀번호를 확인해주세요.')
      return
    }
    if (!data.session) {
      setError('가입 요청은 처리됐지만 세션이 없습니다. 이메일 인증이 필요한 설정일 수 있습니다.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-xl font-medium text-ink">회원가입</h1>
      <p className="mb-8 text-sm text-muted">첫 지도를 만들 준비를 합니다.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          required
          placeholder="이름"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-sm border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
        />
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
          minLength={6}
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
          가입하기
        </button>
      </form>

      <p className="mt-6 text-sm text-muted">
        이미 계정이 있다면{' '}
        <Link to="/login" className="text-ink underline underline-offset-2">
          로그인
        </Link>
      </p>
    </div>
  )
}
