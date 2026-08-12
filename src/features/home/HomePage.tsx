import { BrandStatementSection } from './components/BrandStatementSection'
import { EditorialSection } from './components/EditorialSection'
import { HeroSection } from './components/HeroSection'
import { NewArrivalsSection } from './components/NewArrivalsSection'

export function HomePage() {
  return (
    <>
      <HeroSection />
      <EditorialSection />
      <NewArrivalsSection />
      <BrandStatementSection />
    </>
  )
}
