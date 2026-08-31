import { z } from 'zod'

const userRoleSchema = z.enum(['customer', 'admin'])

const userDtoSchema = z.object({
  id: z.uuid(),
  email: z.email(),
  role: userRoleSchema,
})

export const loginRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'メールアドレスを入力してください。')
    .max(254, 'メールアドレスは254文字以内で入力してください。')
    .pipe(z.email('メールアドレスの形式を確認してください。'))
    .transform((email) => email.toLowerCase()),
  password: z
    .string()
    .min(1, 'パスワードを入力してください。')
    .max(256, 'パスワードは256文字以内で入力してください。'),
})

export const sessionResponseSchema = z.object({
  user: userDtoSchema,
})

export type LoginRequest = z.input<typeof loginRequestSchema>
export type NormalizedLoginRequest = z.output<typeof loginRequestSchema>
export type UserDto = z.infer<typeof userDtoSchema>
export type UserRole = z.infer<typeof userRoleSchema>
