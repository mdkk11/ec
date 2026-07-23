import { z } from 'zod'

export const apiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  fieldErrors: z.record(z.string(), z.array(z.string().min(1)).min(1)).optional(),
})

export type ApiError = z.infer<typeof apiErrorSchema>
