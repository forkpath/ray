/**
 * Compatibility entrypoint for the legacy deployment script.
 * New Nx targets call create-service-lockfile.js directly.
 */
const { createServiceLockfile } = require('./create-service-lockfile')

createServiceLockfile('engine').catch(error => {
  console.error(error)
  process.exitCode = 1
})
