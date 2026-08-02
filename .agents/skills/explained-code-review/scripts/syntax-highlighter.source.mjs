import { createHighlighterCoreSync } from 'shiki/core'
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript'
import bash from 'shiki/langs/bash.mjs'
import c from 'shiki/langs/c.mjs'
import cpp from 'shiki/langs/cpp.mjs'
import csharp from 'shiki/langs/csharp.mjs'
import css from 'shiki/langs/css.mjs'
import go from 'shiki/langs/go.mjs'
import html from 'shiki/langs/html.mjs'
import java from 'shiki/langs/java.mjs'
import javascript from 'shiki/langs/javascript.mjs'
import json from 'shiki/langs/json.mjs'
import jsonc from 'shiki/langs/jsonc.mjs'
import jsx from 'shiki/langs/jsx.mjs'
import kotlin from 'shiki/langs/kotlin.mjs'
import markdown from 'shiki/langs/markdown.mjs'
import mdx from 'shiki/langs/mdx.mjs'
import php from 'shiki/langs/php.mjs'
import python from 'shiki/langs/python.mjs'
import ruby from 'shiki/langs/ruby.mjs'
import rust from 'shiki/langs/rust.mjs'
import scss from 'shiki/langs/scss.mjs'
import sql from 'shiki/langs/sql.mjs'
import swift from 'shiki/langs/swift.mjs'
import tsx from 'shiki/langs/tsx.mjs'
import typescript from 'shiki/langs/typescript.mjs'
import yaml from 'shiki/langs/yaml.mjs'
import githubDark from 'shiki/themes/github-dark.mjs'
import githubLight from 'shiki/themes/github-light.mjs'

export const SHIKI_VERSION = '4.3.1'
export const THEMES = Object.freeze({ light: 'github-light', dark: 'github-dark' })

const highlighter = createHighlighterCoreSync({
  engine: createJavaScriptRegexEngine(),
  langs: [
    ...bash,
    ...c,
    ...cpp,
    ...csharp,
    ...css,
    ...go,
    ...html,
    ...java,
    ...javascript,
    ...json,
    ...jsonc,
    ...jsx,
    ...kotlin,
    ...markdown,
    ...mdx,
    ...php,
    ...python,
    ...ruby,
    ...rust,
    ...scss,
    ...sql,
    ...swift,
    ...tsx,
    ...typescript,
    ...yaml,
  ],
  themes: [githubLight, githubDark],
})

export function tokenize(code, language) {
  return highlighter.codeToTokensWithThemes(code, {
    lang: language,
    themes: THEMES,
  })
}
