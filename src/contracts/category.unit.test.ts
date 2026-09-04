import { describe, expect, it } from 'vitest'

import { categoryCatalog } from '@/features/categories/category-catalog'

import {
  categoryDtoSchema,
  categoryIdSchema,
  categorySlugSchema,
  productCategoryQuerySchema,
} from './category'

describe('category contract', () => {
  it('固定5カテゴリのID・名称・slug・表示順を受け入れる', () => {
    expect(categoryCatalog.map((category) => categoryDtoSchema.parse(category))).toEqual(
      categoryCatalog,
    )
    expect(categoryCatalog.map(({ displayOrder }) => displayOrder)).toEqual([10, 20, 30, 40, 90])
  })

  it.each(['Clothing', 'home_living', '-shoes', 'shoes-'])('%sを不正slugとして拒否する', (slug) => {
    expect(categorySlugSchema.safeParse(slug).success).toBe(false)
  })

  it('UUIDでないcategory IDを拒否する', () => {
    expect(categoryIdSchema.safeParse('').success).toBe(false)
    expect(categoryIdSchema.safeParse('other').success).toBe(false)
  })

  it('category queryは省略・正しい1件だけを受け入れる', () => {
    expect(productCategoryQuerySchema.parse({})).toEqual({})
    expect(productCategoryQuerySchema.parse({ category: 'home-living' })).toEqual({
      category: 'home-living',
    })
    expect(productCategoryQuerySchema.safeParse({ category: '' }).success).toBe(false)
    expect(productCategoryQuerySchema.safeParse({ category: ['clothing', 'shoes'] }).success).toBe(
      false,
    )
  })
})
