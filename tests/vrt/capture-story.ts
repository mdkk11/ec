import { expect, type Page } from '@playwright/test'

type StoryCapture = {
  height: number
  name: string
  storyId: string
  width: number
}

export async function captureStory(page: Page, story: StoryCapture) {
  await page.setViewportSize({ height: story.height, width: story.width })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`/iframe.html?id=${story.storyId}&viewMode=story`)
  await expect(page.locator('#storybook-root')).toBeVisible()
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
