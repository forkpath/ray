console.error(
  '[auth-schema:frozen] Automatic Better Auth schema generation is disabled. ' +
    'Use the governed auth:schema-check/auth:schema-update workflow.'
)
process.exitCode = 1
