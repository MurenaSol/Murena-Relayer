# Murena Relayer (devnet)

Minimal Node/Express relayer that calls the Anchor verifier and returns tx signatures.

## Quick start
```bash
cp .env.example .env
# Fill VERIFIER_PROGRAM_ID and RELAYER_SECRET_BASE58 (base58 secret key)
npm i
npm run dev
```

## Endpoints
- `POST /quote` → `{ feeLamports, etaSeconds }`
- `POST /submit` → `{ accepted, signature, explorerUrl }`

**Note:** After building the Anchor program, compute the 8-byte discriminator for `submit_receipt` (`sha256("global:submit_receipt")[..8]`) and paste it into `buildIxData`.
