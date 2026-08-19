import { expect, type Page } from '@playwright/test'

type StoryCapture = {
  height: number
  loadAllImages?: boolean
  name: string
  storyId: string
  visibleText?: string
  width: number
}

export async function captureStory(page: Page, story: StoryCapture) {
  await page.setViewportSize({ height: story.height, width: story.width })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`/iframe.html?id=${story.storyId}&viewMode=story`)
  await expect(page.locator('#storybook-root')).toBeVisible()
  if (story.visibleText) {
    await expect(page.getByText(story.visibleText, { exact: true })).toBeVisible()
  }
  if (story.loadAllImages) {
    const images = page.locator('img')
    for (let index = 0; index < (await images.count()); index += 1) {
      await images.nth(index).scrollIntoViewIfNeeded()
    }
    await page.evaluate(() => window.scrollTo(0, 0))
  }
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(
      [...document.images].map((image) => {
        if (image.complete) return Promise.resolve()
        return new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => resolve(), { once: true })
        })
      }),
    )
  })
  await expect(page).toHaveScreenshot(`${story.name}.png`, {
    animations: 'disabled',
    caret: 'hide',
    fullPage: true,
  })
}
