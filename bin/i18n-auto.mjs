#!/usr/bin/env node
import { runCli } from '../src/cli.mjs'

runCli(process.argv.slice(2)).catch((e) => {
    console.error(`[i18n-auto] fatal: ${e?.message || e}`)
    process.exit(1)
})
