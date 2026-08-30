import type { CategoryDto, PublicCategoryDto } from '@/contracts/category'

export const categoryCatalog = [
  {
    displayOrder: 10,
    id: '40000000-0000-4000-8000-000000000001',
    name: '衣類',
    slug: 'clothing',
  },
  {
    displayOrder: 20,
    id: '40000000-0000-4000-8000-000000000002',
    name: 'バッグ・服飾小物',
    slug: 'bags-accessories',
  },
  {
    displayOrder: 30,
    id: '40000000-0000-4000-8000-000000000003',
    name: 'シューズ',
    slug: 'shoes',
  },
  {
    displayOrder: 40,
    id: '40000000-0000-4000-8000-000000000004',
    name: 'ホーム・生活雑貨',
    slug: 'home-living',
  },
  {
    displayOrder: 90,
    id: '40000000-0000-4000-8000-000000000005',
    name: 'その他',
    slug: 'other',
  },
] as const satisfies readonly CategoryDto[]

export type CategorySlug = (typeof categoryCatalog)[number]['slug']
export type CategoryId = (typeof categoryCatalog)[number]['id']

export const categoryIds = Object.fromEntries(
  categoryCatalog.map(({ id, slug }) => [slug, id]),
) as Record<CategorySlug, CategoryId>

export const publicCategoryCatalog = categoryCatalog.map(({ name, slug }) => ({
  name,
  slug,
})) satisfies PublicCategoryDto[]
