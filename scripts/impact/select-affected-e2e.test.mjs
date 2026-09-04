import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import {
  matchesAny,
  reverseClosure,
  selectAffectedE2e,
  validateCollectedSpecs,
  validateGraph,
  validateMap,
} from './select-affected-e2e.mjs'

const map = validateMap(JSON.parse(readFileSync('config/impact/e2e-map.json', 'utf8')))

const graph = validateGraph({
  modules: [
    {
      source: 'src/app/cart/page.tsx',
      dependencies: [
        {
          module: '@/features/cart/CartPage',
          resolved: 'src/features/cart/CartPage.tsx',
          couldNotResolve: false,
          followable: true,
        },
      ],
    },
    {
      source: 'src/features/cart/CartPage.tsx',
      dependencies: [
        {
          module: './cart-calculation',
          resolved: 'src/features/cart/cart-calculation.ts',
          couldNotResolve: false,
          followable: true,
        },
      ],
    },
    {
      source: 'src/features/cart/cart-calculation.ts',
      dependencies: [],
    },
  ],
})

test('glob matching treats route brackets literally', () => {
  assert.equal(
    matchesAny('src/app/products/[productId]/page.tsx', ['src/app/products/[productId]/**']),
    true,
  )
})

test('mapped specs must all be collected by a Playwright project', () => {
  assert.doesNotThrow(() =>
    validateCollectedSpecs(['tests/e2e/cart.spec.ts'], '[chromium-cart] › cart.spec.ts:3:1 › cart'),
  )
  assert.throws(() => validateCollectedSpecs(['tests/e2e/cart.spec.ts'], ''), /did not collect/u)
})

test('reverse closure reaches page roots through aliases and relative imports', () => {
  assert.deepEqual(reverseClosure(graph, ['src/features/cart/cart-calculation.ts']), [
    'src/app/cart/page.tsx',
    'src/features/cart/CartPage.tsx',
    'src/features/cart/cart-calculation.ts',
  ])
})

test('known UI changes select mapped specs while safe docs stay ignored', () => {
  const selection = selectAffectedE2e({
    map,
    graph,
    changedFiles: ['docs/README.md', 'src/features/cart/CartPage.tsx'],
  })
  assert.equal(selection.mode, 'selected')
  assert.ok(selection.selectedSpecs.includes('tests/e2e/cart.spec.ts'))
  assert.ok(selection.selectedSpecs.includes('tests/e2e/app-shell.spec.ts'))
})

test('feature roots cover every current E2E responsibility', () => {
  const cases = [
    ['src/features/auth/LoginForm.tsx', 'tests/e2e/authentication.spec.ts'],
    ['src/features/home/HomePage.tsx', 'tests/e2e/product-browsing.spec.ts'],
    ['src/features/products/ProductCard.tsx', 'tests/e2e/product-browsing.spec.ts'],
    ['src/features/cart/CartPage.tsx', 'tests/e2e/cart.spec.ts'],
    ['src/features/coupons/CouponForm.tsx', 'tests/e2e/purchase.spec.ts'],
    ['src/features/orders/OrderDetailView.tsx', 'tests/e2e/purchase.spec.ts'],
    ['src/features/admin/AdminProductsPage.tsx', 'tests/e2e/admin-products.spec.ts'],
  ]
  const responsibilityGraph = validateGraph({
    modules: cases.map(([source]) => ({ source, dependencies: [] })),
  })
  for (const [source, expectedSpec] of cases) {
    const selection = selectAffectedE2e({
      map,
      graph: responsibilityGraph,
      changedFiles: [source],
    })
    assert.equal(selection.mode, 'selected', source)
    assert.ok(selection.selectedSpecs.includes(expectedSpec), source)
  }
})

test('a changed spec always selects itself and the smoke baseline', () => {
  const selection = selectAffectedE2e({
    map,
    graph,
    changedFiles: ['tests/e2e/admin-orders.spec.ts'],
  })
  assert.equal(selection.mode, 'selected')
  assert.ok(selection.selectedSpecs.includes('tests/e2e/admin-orders.spec.ts'))
  assert.ok(selection.selectedSpecs.includes('tests/e2e/app-shell.spec.ts'))
})

test('unknown runtime and high-risk paths fall back to every spec', () => {
  for (const changedFiles of [
    ['src/features/cart/CartPage.tsx', 'src/runtime/new-hook.xyz'],
    ['public/images/product.webp'],
    ['src/server/db/client.ts'],
  ]) {
    const selection = selectAffectedE2e({ map, graph, changedFiles })
    assert.equal(selection.mode, 'full')
    assert.equal(selection.selectedSpecs.length, map.specs.length)
  }
})

test('a dependency reaching the shared app shell falls back to every spec', () => {
  const shellGraph = validateGraph({
    modules: [
      {
        source: 'src/app/providers.tsx',
        dependencies: [
          {
            module: '@/features/auth/SessionProvider',
            resolved: 'src/features/auth/SessionProvider.tsx',
            couldNotResolve: false,
            followable: true,
          },
        ],
      },
      {
        source: 'src/features/auth/SessionProvider.tsx',
        dependencies: [],
      },
    ],
  })
  const selection = selectAffectedE2e({
    map,
    graph: shellGraph,
    changedFiles: ['src/features/auth/SessionProvider.tsx'],
  })
  assert.equal(selection.mode, 'full')
  assert.match(selection.fallbackReason, /dependency reaches high-risk/u)
})

test('deleted or otherwise unrepresented source paths fall back to full', () => {
  const selection = selectAffectedE2e({
    map,
    graph,
    changedFiles: ['src/features/cart/CartPage.tsx', 'src/runtime/deleted-helper.ts'],
  })
  assert.equal(selection.mode, 'full')
})

test('APIs without direct E2E coverage fall back to full E2E', () => {
  const apiGraph = validateGraph({
    modules: [
      { source: 'src/app/api/products/route.ts', dependencies: [] },
      { source: 'src/app/api/orders/[orderId]/route.ts', dependencies: [] },
    ],
  })
  for (const filePath of [
    'src/app/api/products/route.ts',
    'src/app/api/orders/[orderId]/route.ts',
  ]) {
    assert.equal(
      selectAffectedE2e({ map, graph: apiGraph, changedFiles: [filePath] }).mode,
      'full',
      filePath,
    )
  }
})

test('unresolved internal dependency invalidates the graph', () => {
  assert.throws(
    () =>
      validateGraph({
        modules: [
          {
            source: 'src/app/page.tsx',
            dependencies: [
              {
                module: '@/features/missing',
                couldNotResolve: true,
                followable: false,
              },
            ],
          },
        ],
      }),
    /unresolved internal dependency/u,
  )
})

test('duplicate modules and non-style unfollowable edges invalidate the graph', () => {
  assert.throws(
    () =>
      validateGraph({
        modules: [
          { source: 'src/app/page.tsx', dependencies: [] },
          { source: 'src/app/page.tsx', dependencies: [] },
        ],
      }),
    /duplicate modules/u,
  )
  assert.doesNotThrow(() =>
    validateGraph({
      modules: [
        {
          source: 'src/app/layout.tsx',
          dependencies: [
            {
              module: './globals.css',
              resolved: 'src/app/globals.css',
              couldNotResolve: false,
              followable: false,
            },
          ],
        },
      ],
    }),
  )
  assert.throws(
    () =>
      validateGraph({
        modules: [
          {
            source: 'src/app/page.tsx',
            dependencies: [
              {
                module: '@/features/home/HomePage',
                resolved: 'src/features/home/HomePage.tsx',
                couldNotResolve: false,
                followable: true,
              },
            ],
          },
        ],
      }),
    /missing a module/u,
  )
})
