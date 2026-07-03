# Desktop HTTPS Root Redirect

## Symptom

The desktop app showed the offline shell for `https://zentro.relicware.co/` even though the web app loaded in a browser.

## Root cause

The desktop shell checks the configured URL before loading it. The production root URL returned a Vike `+redirects` response with `Location: http://zentro.relicware.co/dashboard`, downgrading the configured HTTPS origin to HTTP. Electron correctly rejected the redirect because the wrapper only allows navigation inside the configured origin.

## Solution

Move the root redirect from Vike `+redirects` into the root route guard. Guard redirects in the app already emit relative `Location` headers, so `/` redirects to `/dashboard` without changing the configured HTTPS origin.

## Verification

- Reproduced with `fetch("https://zentro.relicware.co/", { redirect: "manual" })`, which returned `301` and `Location: http://zentro.relicware.co/dashboard`.
- Confirmed `https://zentro.relicware.co/dashboard` already returns a relative `Location: /login`.
