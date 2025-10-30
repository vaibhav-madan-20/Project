require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers');
const { FlashbotsBundleProvider } = require('@flashbots/ethers-provider-bundle');

const app = express();
app.use(express.json());

const WS_PROVIDER = process.env.WS_PROVIDER;
const HTTP_PROVIDER = process.env.HTTP_PROVIDER;
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!WS_PROVIDER || !HTTP_PROVIDER || !PRIVATE_KEY) {
    console.error("Missing .env values");
    process.exit(1);
}

const monitoredContracts = [
    // add your deployed StableSwap address here after deploy
    process.env.SWAP_ADDRESS || ""
];

const providerWs = new ethers.providers.WebSocketProvider(WS_PROVIDER);
const provider = new ethers.providers.JsonRpcProvider(HTTP_PROVIDER);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

let flashbotsProvider;

async function init() {
    flashbotsProvider = await FlashbotsBundleProvider.create(provider, wallet, process.env.FLASHBOTS_RELAY);
    console.log("Flashbots provider created");
}
init();

const flagged = []; // in-memory; a production app would use a DB

// helper: estimate slippage by calling contract's TWAP consult for the tx value
async function estimateImpact(tx) {
    try {
        // very naive: decode to see if tx.to is monitored contract (we check above)
        // For a better approach decode tx.data with ABI of StableSwap (omitted for brevity)
        // We'll call the TWAP oracle with the input amount if we can decode it.

        // for demonstration we just return a random risk metric
        const risk = Math.random(); // 0..1
        const estLoss = risk * 0.02; // up to 2% of amount
        return { risk, estLoss };
    } catch (e) {
        return { risk: 0, estLoss: 0 };
    }
}

// listen to pending txs
providerWs.on('pending', async (txHash) => {
    try {
        const tx = await provider.getTransaction(txHash);
        if (!tx || !tx.to) return;
        if (monitoredContracts.length > 0 && monitoredContracts.includes(tx.to.toLowerCase())) {
            // potential target
            const impact = await estimateImpact(tx);

            if (impact.risk > 0.6) {
                const record = {
                    hash: tx.hash,
                    from: tx.from,
                    to: tx.to,
                    value: tx.value.toString(),
                    data: tx.data,
                    risk: impact.risk,
                    estLoss: impact.estLoss,
                    timestamp: Date.now()
                };
                flagged.push(record);
                console.log("Flagged tx:", record);
            }
        }
    } catch (e) {
        // ignore noise
    }
});

// API endpoints
app.get('/api/flags', (req, res) => {
    res.json(flagged.slice(-100));
});

// Endpoint to attempt to relay protected tx via Flashbots (requires a signed replacement tx payload)
app.post('/api/relay', async (req, res) => {
    // body should supply {signedTxHexes: [...], targetBlockNumber}
    try {
        const { signedTxHexes, targetBlockNumber } = req.body;
        if (!signedTxHexes || !targetBlockNumber) return res.status(400).send("bad request");
        // create bundle
        const signedBundle = signedTxHexes;
        const bundleResponse = await flashbotsProvider.sendRawBundle(signedBundle, targetBlockNumber);
        const resolved = await bundleResponse.wait();
        res.json({ bundleResponse: resolved });
    } catch (err) {
        console.error(err);
        res.status(500).send(err.toString());
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Middleware API listening on ${PORT}`);
});
