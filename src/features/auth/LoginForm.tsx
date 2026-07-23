'use client'

import {
  type FormEvent,
  useRef,
  useState,
} from 'react'

import {
  loginRequestSchema,
  type UserDto,
} from '@/contracts/session'
import { ApiClientError } from '@/lib/api-client/request-json'
import { login } from '@/lib/api-client/session'

type FieldErrors = Partial<Record<'email' | 'password', string[]>>

type LoginFormProps = {
  onAuthenticated: (user: UserDto) => void
}

function collectFieldErrors(error: {
  issues: { message: string; path: PropertyKey[] }[]
}): FieldErrors {
  const errors: FieldErrors = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (field !== 'email' && field !== 'password') continue
    errors[field] ??= []
    errors[field]?.push(issue.message)
  }
  return errors
}

export function LoginForm({ onAuthenticated }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingRef = useRef(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    setFormError(undefined)
    const parsed = loginRequestSchema.safeParse({ email, password })
    if (!parsed.success) {
      const errors = collectFieldErrors(parsed.error)
      setFieldErrors(errors)
      if (errors.email) emailRef.current?.focus()
      else if (errors.password) passwordRef.current?.focus()
      return
    }

    setFieldErrors({})
    submittingRef.current = true
    setIsSubmitting(true)
    try {
      const session = await login(parsed.data)
      onAuthenticated(session.user)
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.fieldErrors) {
          setFieldErrors(error.fieldErrors)
        }
        setFormError(
          error.code === 'INVALID_CREDENTIALS'
            ? 'メールアドレスまたはパスワードが正しくありません。'
            : 'ログインできませんでした。入力内容を保ったまま、もう一度お試しください。',
        )
      } else {
        setFormError(
          'ログインできませんでした。入力内容を保ったまま、もう一度お試しください。',
        )
      }
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return (
    <form className="mt-8 space-y-6" noValidate onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-semibold" htmlFor="email">
          メールアドレス
        </label>
        <input
          aria-describedby={fieldErrors.email ? 'email-error' : undefined}
          aria-invalid={fieldErrors.email ? true : undefined}
          autoComplete="email"
          className="mt-2 min-h-12 w-full border border-line bg-surface px-4 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20"
          id="email"
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          ref={emailRef}
          type="email"
          value={email}
        />
        {fieldErrors.email ? (
          <p className="mt-2 text-sm text-red-700" id="email-error">
            {fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-semibold" htmlFor="password">
          パスワード
        </label>
        <input
          aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          aria-invalid={fieldErrors.password ? true : undefined}
          autoComplete="current-password"
          className="mt-2 min-h-12 w-full border border-line bg-surface px-4 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20"
          id="password"
          maxLength={256}
          onChange={(event) => setPassword(event.target.value)}
          ref={passwordRef}
          type="password"
          value={password}
        />
        {fieldErrors.password ? (
          <p className="mt-2 text-sm text-red-700" id="password-error">
            {fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p
          aria-live="assertive"
          className="border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800"
          role="alert"
        >
          {formError}
        </p>
      ) : null}

      <button
        className="min-h-12 w-full bg-ink px-6 py-3 text-sm font-semibold tracking-[0.08em] text-white transition hover:bg-ink/85 disabled:cursor-wait disabled:opacity-60"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? 'ログイン中…' : 'ログイン'}
      </button>
    </form>
  )
}
