import { defineBuildConfig } from 'unbuild'

export default defineBuildConfig({
  entries: [
    {
      builder: 'mkdist',
      input: 'src/',
      format: 'cjs',
      outDir: 'dist'
    },
  ],
  declaration: true,
  failOnWarn: false,
  clean: true,
  outDir: 'dist',
})
