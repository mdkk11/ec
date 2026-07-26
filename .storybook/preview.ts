import type { Preview } from '@storybook/nextjs-vite'

import '@fontsource-variable/inter'
import '@fontsource-variable/noto-sans-jp'
import '@fontsource-variable/cormorant-garamond'
import '@fontsource-variable/noto-serif-jp'
import '../src/app/globals.css'

const preview: Preview = {
  parameters: {
    a11y: {
      test: 'error',
    },
    controls: {
      matchers: {
        color: /(background|color)$/iu,
        date: /Date$/u,
      },
    },
  },
}

export default preview
