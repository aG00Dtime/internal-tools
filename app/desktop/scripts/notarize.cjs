'use strict'

const { notarize } = require('@electron/notarize')
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') })

exports.default = async function notarizing(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appName = context.packager.appInfo.productFilename
  const appPath = `${context.appOutDir}/${appName}.app`

  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD || !process.env.APPLE_TEAM_ID) {
    console.log(`Skipping notarization for ${appName} (set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID to enable).`)
    return
  }

  console.log(`Notarizing ${appName}…`)

  try {
    await notarize({
      appBundleId: 'com.v75.internal.nis-electronic-schedule',
      appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
    })
    console.log(`Notarization complete.`)
  } catch (err) {
    const message = err && (err.stack || err.message || String(err))
    console.warn(`Notarization failed; continuing with signed (un-notarized) build:\n${message}`)
  }
}
