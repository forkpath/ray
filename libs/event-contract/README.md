# Event Contract

Universal, versioned event envelopes shared by Node, web and native runtimes.
This library defines transport-neutral contracts only; it must not import a
broker, database, NestJS or platform-specific implementation.

Wave 6 intentionally ships only the `platform.smoke` consumer first. Product
events require their own reviewed contract and handler in a later change.
