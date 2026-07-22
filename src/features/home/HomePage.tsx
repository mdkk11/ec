import { BrandStatementSection } from './components/BrandStatementSection'
import { EditorialSection } from './components/EditorialSection'
import { HeroSection } from './components/HeroSection'
import { NewArrivalsSection } from './components/NewArrivalsSection'
import { NewsletterSection } from './components/NewsletterSection'

export function HomePage() {
  return (
    <>
      <HeroSection />
      <EditorialSection />
      <NewArrivalsSection />
      <BrandStatementSection />
      <NewsletterSection />
    </>
  )
}
