# 第三者ソフトウェアに関する通知

生成済みの`scripts/syntax-highlighter.bundle.mjs`には、
[Shiki 4.3.1](https://github.com/shikijs/shiki)のコードとデータが含まれます。
対象には、選択したTextMate grammarとGitHub Light / GitHub Dark themeが含まれます。
ShikiはMIT Licenseのもとで配布されています。上流のgrammarとthemeが由来や
license metadataを提供している場合、その情報は生成済みbundle内に保持しています。

bundleはesbuild 0.28.1で生成し、依存packageが出力するlicense commentを保持するため
`legalComments: "eof"`を指定しています。esbuild自体はbuild時の依存であり、runtime
codeとしてbundleには含めていません。
