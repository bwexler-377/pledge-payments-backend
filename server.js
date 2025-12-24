const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_API_KEY);

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Payment API is running' });
});

// Create Stripe Checkout Session
app.post('/api/create-checkout', async (req, res) => {
  try {
    const { accountId, amount, fullName, email } = req.body;

    console.log('Creating checkout session:', { accountId, amount, fullName, email });

    // Validate inputs
    if (!accountId || !amount) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing accountId or amount' 
      });
    }

    // Validate minimum amount (Stripe requires $0.50)
    const amountCents = Math.round(amount * 100);
    if (amountCents < 50) {
      return res.status(400).json({ 
        success: false, 
        error: 'Minimum payment is $0.50' 
      });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      client_reference_id: accountId,
      customer_creation: 'always',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Pledge Payment - Account ${accountId}`,
              description: `Pledge payment for Barkai Yeshivah`
            },
            unit_amount: amountCents
          },
          quantity: 1
        }
      ],
      metadata: {
        account_id: accountId,
        donor_name: fullName || '',
        donor_email: email || '',
        amount_paid: amount.toFixed(2),
        source: 'pledge_mail_merge',
        payment_date: new Date().toISOString()
      },
      billing_address_collection: 'auto',
      submit_type: 'pay',
      allow_promotion_codes: true,
      success_url: 'https://www.barkaiyeshivah.org/userdonations/donation-payment-success',
      cancel_url: 'https://www.barkaiyeshivah.org/userdonations/donation-payment-cancelled'
    });

    console.log('✅ Checkout session created:', session.id);

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      amount: amount
    });

  } catch (error) {
    console.error('❌ Error creating checkout session:', error.message);
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create checkout session'
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error' 
  });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Payment API running on port ${PORT}`);
});
