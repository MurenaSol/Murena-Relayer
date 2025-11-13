import 'dotenv/config';
import express from 'express';
import bs58 from 'bs58';
import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js';

const app = express(); app.use(express.json());

const RPC = process.env.RPC || 'https://api.devnet.solana.com';
const PROGRAM_ID = new PublicKey(process.env.VERIFIER_PROGRAM_ID || 'MuReNa1111111111111111111111111111111');
const RELAYER = Keypair.fromSecretKey(bs58.decode(process.env.RELAYER_SECRET_BASE58 || bs58.encode(Uint8Array.from({length:64},(_,i)=>i%255))));
const connection = new Connection(RPC, 'confirmed');

app.get('/status', (_, res) => res.json({ ok: true, network: 'devnet' }));

app.post('/quote', (req, res) => {
  const { amount } = req.body || {};
  res.json({ feeLamports: '5000', etaSeconds: 10, amount });
});

app.post('/submit', async (req, res) => {
  try {
    const { merchant, payer, receiptHashHex, memoHashHex } = req.body;
    if(!merchant || !payer || !receiptHashHex || !memoHashHex) {
      return res.status(400).json({ error: 'bad_request', message: 'merchant, payer, receiptHashHex, memoHashHex required' });
    }
    const payerPub = new PublicKey(payer);
    const merchantPub = new PublicKey(merchant);

    const data = buildIxData(receiptHashHex, memoHashHex);
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: merchantPub, isSigner: false, isWritable: false },
        { pubkey: payerPub, isSigner: true, isWritable: false },
      ],
      data
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    const tx = new Transaction({ feePayer: RELAYER.publicKey, blockhash, lastValidBlockHeight }).add(ix);
    tx.sign(RELAYER);
    const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

    return res.json({ accepted: true, signature: sig, explorerUrl: `https://solscan.io/tx/${sig}?cluster=devnet` });
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: 'submit_failed', message: String(e?.message || e) });
  }
});

// TODO: replace with real 8-byte discriminator after Anchor build
function buildIxData(receiptHashHex, memoHashHex) {
  const disc = Uint8Array.from([0,0,0,0,0,0,0,0]); // sha256("global:submit_receipt")[..8]
  const r = hexTo32(receiptHashHex);
  const m = hexTo32(memoHashHex);
  return Buffer.concat([Buffer.from(disc), Buffer.from(r), Buffer.from(m)]);
}
function hexTo32(hex) {
  const clean = String(hex).replace(/^0x/, '');
  const b = Buffer.from(clean, 'hex');
  if (b.length !== 32) throw new Error('hash must be 32 bytes');
  return b;
}

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Relayer on :${port}`));
