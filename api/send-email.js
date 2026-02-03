const fetch = require('node-fetch');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const { to_email, subject, message, from_name } = req.body;

        console.log('📧 SENDING EMAIL:', {
            to: to_email,
            subject: subject
        });

        const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                service_id: process.env.EMAILJS_SERVICE_ID,
                template_id: process.env.EMAILJS_TEMPLATE_ID,
                user_id: process.env.EMAILJS_PUBLIC_KEY,
                accessToken: process.env.EMAILJS_PRIVATE_KEY,
                template_params: {
                    to_email,
                    subject,
                    message,
                    from_name: from_name || 'CryptoPro Platform',
                    reply_to: 'noreply@cryptopro.com'
                }
            })
        });

        if (response.ok) {
            console.log('✅ EMAIL SENT to', to_email);
            return res.status(200).json({ success: true });
        } else {
            throw new Error('Email sending failed');
        }

    } catch (error) {
        console.error('❌ Email Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
