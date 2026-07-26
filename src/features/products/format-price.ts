const jpyFormatter = new Intl.NumberFormat('ja-JP', {
  maximumFractionDigits: 0,
})

export function formatPrice(price: number) {
  return `¥${jpyFormatter.format(price)}`
}
