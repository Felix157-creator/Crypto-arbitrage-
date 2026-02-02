const fetch = require('node-fetch');

const MPESA_CONFIG = {
    CONSUMER_KEY: process.env.MPESA_CONSUMER_KEY,
    CONSUMER_SECRET: process.env.MPESA_CONSUMER_SECRET,
    PASSKEY: process.env.MPESA_PASSKEY,
    SHORTCODE: process.env.MPESA_SHORTCODE,
    SANDBOX_URL: 'https://sandbox.safaricom.co.ke',
    PRODUCTION_URL: 'https://api.safaricom.co.ke'
};

const BASE_URL = MPESA_CONFIG.SANDBOX_URL;

async function getMpesaToken() {
    const auth = Buffer.from(
        `${MPESA_CONFIG.CONSUMER_KEY}:${MPESA_CONFIG.CONSUMER_SECRET}`
    ).toString('base64');

    const response = await fetch(
        `${BASE_URL}/oauth/v1/generate?grant_type=client_credentials`,
        {
            headers: {
                Authorization: `Basic ${auth}`
            }
        }
    );

    const data = await response.json();
    return data.access_token;
}

async function initiateStkPush(phoneNumber, amount, accountReference) {
    const token = await getMpesaToken();
    const timestamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, -3);
    
    const password = Buffer.from(
        `${MPESA_CONFIG.SHORTCODE}${MPESA_CONFIG.PASSKEY}${timestamp}`
    ).toString('base64');

    const amountKES = Math.round(amount * 130);

    const response = await fetch(
        `${BASE_URL}/mpesa/stkpush/v1/processrequest`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                BusinessShortCode: MPESA_CONFIG.SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                TransactionType: 'CustomerPayBillOnline',
                Amount: amountKES,
                PartyA: phoneNumber,
                PartyB: MPESA_CONFIG.SHORTCODE,
                PhoneNumber: phoneNumber,
                CallBackURL: `https://${process.env.VERCEL_URL}/api/mpesa-callback`,
                AccountReference: accountReference,
                TransactionDesc: 'CryptoPro Deposit'
            })
        }
    );

    return await response.json();
}

async function queryStkStatus(checkoutRequestID) {
    const token = await getMpesaToken();
    const timestamp = new Date()
        .toISOString()
        .replace(/[^0-9]/g, '')
        .slice(0, -3);
    
    const password = Buffer.from(
        `${MPESA_CONFIG.SHORTCODE}${MPESA_CONFIG.PASSKEY}${timestamp}`
    ).toString('base64');

    const response = await fetch(
        `${BASE_URL}/mpesa/stkpushquery/v1/query`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                BusinessShortCode: MPESA_CONFIG.SHORTCODE,
                Password: password,
                Timestamp: timestamp,
                CheckoutRequestID: checkoutRequestID
            })
        }
    );

    return await response.json();
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'POST') {
            const { action, phoneNumber, amount, accountReference, checkoutRequestID } = req.body;

            if (action === 'initiate') {
                console.log('🔥 INITIATING M-PESA PAYMENT:', {
                    phone: phoneNumber,
                    amount: amount,
                    amountKES: amount * 130
                });

                const result = await initiateStkPush(phoneNumber, amount, accountReference);
                console.log('📱 M-Pesa Response:', result);
                return res.status(200).json(result);
            }

            if (action === 'query') {
                console.log('🔍 CHECKING M-PESA STATUS:', checkoutRequestID);
                const result = await queryStkStatus(checkoutRequestID);
                console.log('✅ M-Pesa Status:', result);
                return res.status(200).json(result);
            }

            if (req.body.Body && req.body.Body.stkCallback) {
                const callback = req.body.Body.stkCallback;
                console.log('💰 M-PESA CALLBACK:', JSON.stringify(callback, null, 2));

                if (callback.ResultCode === 0) {
                    const items = callback.CallbackMetadata.Item;
                    const amountPaid = items.find(item => item.Name === 'Amount').Value;
                    const mpesaRef = items.find(item => item.Name === 'MpesaReceiptNumber').Value;

                    console.log('✅✅✅ PAYMENT CONFIRMED!');
                    console.log('Amount (KES):', amountPaid);
                    console.log('M-Pesa Ref:', mpesaRef);
                }
                
                return res.status(200).json({
                    ResultCode: 0,
                    ResultDesc: 'Success'
                });
            }
        }

        return res.status(400).json({ error: 'Invalid request' });

    } catch (error) {
        console.error('❌ M-Pesa Error:', error);
        return res.status(500).json({ 
            error: 'Payment processing failed',
            details: error.message 
        });
    }
};
