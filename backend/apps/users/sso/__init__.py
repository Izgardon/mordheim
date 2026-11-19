"""Social sign-in (SSO): one shared OAuth 2.0 + PKCE flow, one module per provider.

`base` holds the shapes, `registry` the table of providers, `client` the two HTTP calls every provider needs, and
`google` / `discord` what each one puts in them. Adding a third (Apple) is a module and a row in the registry; nothing
else here knows a provider by name. The flow itself is `apps.users.services.sso`.
"""
