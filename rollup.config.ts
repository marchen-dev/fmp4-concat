import fs from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'rollup'
import { dts } from 'rollup-plugin-dts'
import { swc } from 'rollup-plugin-swc3'

export default defineConfig([
  // 主要构建配置
  {
    input: 'src/index.ts',
    output: [
      {
        file: 'dist/index.js',
        format: 'commonjs',
        exports: 'named',
      },
      {
        file: 'dist/index.mjs',
        format: 'esm',
      },
    ],
    plugins: [
      swc({
        isModule: true,
        jsc: {
          target: 'es2020',
          parser: {
            syntax: 'typescript',
            tsx: false,
            decorators: false,
          },
          transform: {
            legacyDecorator: true,
            decoratorMetadata: true,
          },
          minify: {
            compress: {
              passes: 2,
              const_to_let: false,
            },
            mangle: {},
            module: true,
          },
        },
        minify: true,
      }),
    ],
    external: [],
    cache: true,
  },
  // 类型声明文件构建
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'esm',
    },
    plugins: [
      dts(),
      {
        name: 'generate-dts-mts',
        writeBundle: () => {
          const dtsPath = path.join('dist', 'index.d.ts')
          if (fs.existsSync(dtsPath)) {
            const content = fs.readFileSync(dtsPath, 'utf8')
            fs.writeFileSync(dtsPath.replace('.d.ts', '.d.mts'), content)
          }
        },
      },
    ],
  },
])
