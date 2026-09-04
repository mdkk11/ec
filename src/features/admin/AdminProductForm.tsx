'use client'

import type { SyntheticEvent } from 'react'

import { Button } from '@/components/button/Button'
import type { AdminProductDto } from '@/contracts/product'
import { categoryCatalog } from '@/features/categories/category-catalog'
import { formatPrice } from '@/features/products/format-price'

export type AdminProductFormValues = {
  categoryId: string
  description: string
  imagePath: string
  isPublished: boolean
  name: string
  price: string
  stock: string
}

export type AdminProductFormField = keyof AdminProductFormValues
export type AdminProductFieldErrors = Partial<Record<AdminProductFormField, string[]>>

type AdminProductFormProps = {
  blocked?: boolean
  conflictProduct?: AdminProductDto | null
  errorMessage?: string | null
  fieldErrors?: AdminProductFieldErrors
  idPrefix: string
  includeStock?: boolean
  mode: 'create' | 'edit'
  onAcceptLatest?: () => void
  onChange: (field: AdminProductFormField, value: boolean | string) => void
  onSubmit: (event: SyntheticEvent<HTMLFormElement, SubmitEvent>) => void
  pending?: boolean
  statusMessage?: string | null
  submitDisabled?: boolean
  values: AdminProductFormValues
}

function FieldError({ errors, id }: { errors?: string[]; id: string }) {
  return errors?.[0] ? (
    <p className="mt-2 text-sm text-accent" id={id} role="alert">
      {errors[0]}
    </p>
  ) : null
}

const inputClassName =
  'mt-2 min-h-12 w-full border border-line bg-surface px-4 text-base outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/20 disabled:cursor-not-allowed disabled:bg-canvas disabled:text-muted'

export function AdminProductForm({
  blocked = false,
  conflictProduct = null,
  errorMessage = null,
  fieldErrors = {},
  idPrefix,
  includeStock = false,
  mode,
  onAcceptLatest,
  onChange,
  onSubmit,
  pending = false,
  statusMessage = null,
  submitDisabled = false,
  values,
}: AdminProductFormProps) {
  const disabled = blocked || pending
  const fieldId = (field: AdminProductFormField) => `${idPrefix}-${field}`
  const errorId = (field: AdminProductFormField) => `${fieldId(field)}-error`

  return (
    <form
      aria-busy={pending}
      className="border border-line bg-surface p-5 sm:p-7"
      noValidate
      onSubmit={onSubmit}
    >
      <div className="grid gap-6">
        <div>
          <label className="text-sm font-semibold" htmlFor={fieldId('categoryId')}>
            カテゴリ
          </label>
          <select
            aria-describedby={fieldErrors.categoryId ? errorId('categoryId') : undefined}
            aria-invalid={fieldErrors.categoryId ? true : undefined}
            className={inputClassName}
            disabled={disabled}
            id={fieldId('categoryId')}
            onChange={(event) => onChange('categoryId', event.target.value)}
            value={values.categoryId}
          >
            <option disabled={mode === 'edit'} value="">
              カテゴリを選択してください
            </option>
            {categoryCatalog.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <FieldError errors={fieldErrors.categoryId} id={errorId('categoryId')} />
        </div>

        <div>
          <label className="text-sm font-semibold" htmlFor={fieldId('name')}>
            商品名
          </label>
          <input
            aria-describedby={fieldErrors.name ? errorId('name') : undefined}
            aria-invalid={fieldErrors.name ? true : undefined}
            className={inputClassName}
            disabled={disabled}
            id={fieldId('name')}
            onChange={(event) => onChange('name', event.target.value)}
            type="text"
            value={values.name}
          />
          <FieldError errors={fieldErrors.name} id={errorId('name')} />
        </div>

        <div>
          <label className="text-sm font-semibold" htmlFor={fieldId('description')}>
            商品説明
          </label>
          <textarea
            aria-describedby={fieldErrors.description ? errorId('description') : undefined}
            aria-invalid={fieldErrors.description ? true : undefined}
            className={`${inputClassName} min-h-32 py-3`}
            disabled={disabled}
            id={fieldId('description')}
            onChange={(event) => onChange('description', event.target.value)}
            value={values.description}
          />
          <FieldError errors={fieldErrors.description} id={errorId('description')} />
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <label className="text-sm font-semibold" htmlFor={fieldId('price')}>
              価格（円）
            </label>
            <input
              aria-describedby={fieldErrors.price ? errorId('price') : undefined}
              aria-invalid={fieldErrors.price ? true : undefined}
              className={inputClassName}
              disabled={disabled}
              id={fieldId('price')}
              inputMode="numeric"
              min={0}
              onChange={(event) => onChange('price', event.target.value)}
              step={1}
              type="number"
              value={values.price}
            />
            <FieldError errors={fieldErrors.price} id={errorId('price')} />
          </div>
          {includeStock ? (
            <div>
              <label className="text-sm font-semibold" htmlFor={fieldId('stock')}>
                在庫数
              </label>
              <input
                aria-describedby={fieldErrors.stock ? errorId('stock') : undefined}
                aria-invalid={fieldErrors.stock ? true : undefined}
                className={inputClassName}
                disabled={disabled}
                id={fieldId('stock')}
                inputMode="numeric"
                min={0}
                onChange={(event) => onChange('stock', event.target.value)}
                step={1}
                type="number"
                value={values.stock}
              />
              <FieldError errors={fieldErrors.stock} id={errorId('stock')} />
            </div>
          ) : null}
        </div>

        <div>
          <label className="text-sm font-semibold" htmlFor={fieldId('imagePath')}>
            画像パス
          </label>
          <input
            aria-describedby={fieldErrors.imagePath ? errorId('imagePath') : undefined}
            aria-invalid={fieldErrors.imagePath ? true : undefined}
            className={inputClassName}
            disabled={disabled}
            id={fieldId('imagePath')}
            onChange={(event) => onChange('imagePath', event.target.value)}
            placeholder="/images/fixtures/product-placeholder.svg"
            type="text"
            value={values.imagePath}
          />
          <FieldError errors={fieldErrors.imagePath} id={errorId('imagePath')} />
        </div>

        <label className="flex min-h-12 items-center gap-3 text-sm font-semibold">
          <input
            checked={values.isPublished}
            className="h-5 w-5 accent-ink"
            disabled={disabled}
            onChange={(event) => onChange('isPublished', event.target.checked)}
            type="checkbox"
          />
          購入者へ公開する
        </label>
      </div>

      {conflictProduct ? (
        <section
          aria-live="assertive"
          className="mt-7 border border-accent bg-[#fff8f5] p-5"
          role="alert"
        >
          <h3 className="font-serif text-2xl">最新の商品情報を確認してください</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            入力内容は保持しています。最新値を反映してから、変更内容を確認し直してください。
          </p>
          <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted">商品名</dt>
              <dd>{conflictProduct.name}</dd>
            </div>
            <div>
              <dt className="text-muted">カテゴリ</dt>
              <dd>{categoryCatalog.find(({ id }) => id === conflictProduct.categoryId)?.name}</dd>
            </div>
            <div>
              <dt className="text-muted">価格</dt>
              <dd>{formatPrice(conflictProduct.price)}</dd>
            </div>
            <div>
              <dt className="text-muted">在庫</dt>
              <dd>{conflictProduct.stock}</dd>
            </div>
            <div>
              <dt className="text-muted">公開状態</dt>
              <dd>{conflictProduct.isPublished ? '公開' : '非公開'}</dd>
            </div>
            <div>
              <dt className="text-muted">version</dt>
              <dd>{conflictProduct.version}</dd>
            </div>
          </dl>
          {onAcceptLatest ? (
            <Button className="mt-5" onClick={onAcceptLatest} type="button" variant="secondary">
              最新値をフォームへ反映
            </Button>
          ) : null}
        </section>
      ) : null}

      {errorMessage ? (
        <p className="mt-6 text-sm text-accent" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {statusMessage ? (
        <p className="mt-6 text-sm text-accent" role="status">
          {statusMessage}
        </p>
      ) : null}

      <Button className="mt-7 w-full sm:w-auto" disabled={disabled || submitDisabled} type="submit">
        {pending
          ? mode === 'create'
            ? '商品を作成しています…'
            : '商品を更新しています…'
          : mode === 'create'
            ? '商品を作成'
            : '商品情報を更新'}
      </Button>
    </form>
  )
}
