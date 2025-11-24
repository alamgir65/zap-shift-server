const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.STRIPE_KEY);

const generateTrackingId = () => {
  const prefix = 'TRK';
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `${prefix}${timestamp}${random}`;
  // Example: TRK17324567891234567
}
// middleware 
app.use(express.json())
app.use(cors())

// db
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@alamgir.ilrz28i.mongodb.net/?appName=alamgir`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res) => {
  res.send('Zap-shift is now shifting shifting.......')
})


async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db('zaf_shift_db');
    const parcelsCollection = db.collection('parcels');
    const paymentCollection = db.collection('payments');

    // parcel all api's here

    app.get('/parcels', async (req, res) => {
      const query = {};
      const email = req.query.email;
      if (email) {
        query.sender_email = email;
      }
      const cursor = parcelsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.post('/parcels', async (req, res) => {
      const parcel = req.body;
      parcel.created_id = new Date();
      parcel.payment_status = 'unpaid';
      const result = await parcelsCollection.insertOne(parcel);
      res.send(result);
    })

    app.get('/parcels/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await parcelsCollection.findOne(query);
      res.send(result);
    })

    app.delete('/parcels/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = parcelsCollection.deleteOne(query);
      res.send(result);
    })

    // payment api's are here

    app.post('/payment-checkout-session', async (req, res) => {
      try {
        const paymentInfo = req.body;
        const amount = parseInt(paymentInfo.cost) * 100;

        const session = await stripe.checkout.sessions.create({
          line_items: [{
            price_data: {
              currency: 'usd',
              unit_amount: amount,
              product_data: {
                name: paymentInfo.parcel_name
              }
            },
            quantity: 1
          }],
          mode: 'payment',
          customer_email: paymentInfo.sender_email,
          metadata: {
            parcel_id: paymentInfo.percel_id,      // ✅ Fixed: "parcel_id"
            parcel_name: paymentInfo.parcel_name
          },
          success_url: `${process.env.SITE_DOMAIN}/dashboard/payment-success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.SITE_DOMAIN}/dashboard/payment-cancelled`,
        })

        res.send({ url: session.url });
      } catch (error) {
        console.error('Stripe error:', error);
        res.status(500).send({ error: error.message });
      }
    })

    app.patch('/payment-success', async (req, res) => {
      try {
        const session_id = req.query.session_id;

        if (!session_id) {
          return res.status(400).send({ success: false, message: 'No session ID provided' });
        }

        const session = await stripe.checkout.sessions.retrieve(session_id);
        console.log('Session Retrieved:', session);

        if (session.payment_status === 'paid') {
          const trackingId = generateTrackingId();
          const parcel_id = session.metadata.parcel_id;  // ✅ Fixed: "parcel_id"

          const query = { _id: new ObjectId(parcel_id) };
          const update = {
            $set: {
              payment_status: 'paid',
              tracking_id: trackingId,
              booking_date: new Date()
            }
          };

          const result = await parcelsCollection.updateOne(query, update);

          const payment = {
            amount: session.amount_total / 100,  // ✅ Convert cents to dollars
            currency: session.currency,
            customer_email: session.customer_email,
            parcel_id: parcel_id,  // ✅ Use the variable
            parcel_name: session.metadata.parcel_name,
            transaction_id: session.payment_intent,
            payment_status: session.payment_status,
            tracking_id: trackingId,
            paid_at: new Date()
          }

          const resultPayment = await paymentCollection.insertOne(payment);

          return res.send({
            success: true,
            modifyResult: result,  // ✅ Fixed typo
            tracking_id: trackingId,
            transaction_id: session.payment_intent,
            paymentInfo: resultPayment
          });
        }

        // Only reaches here if payment_status is not 'paid'
        res.send({ success: false, message: 'Payment not completed' });

      } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).send({ success: false, error: error.message });
      }
    })

    app.post('/create-checkout-session', async (req, res) => {
      const paymentInfo = req.body;
      const amount = parseInt(paymentInfo.cost) * 100;
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'USD',
              unit_amount: amount,
              product_data: {
                name: paymentInfo.name
              }
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        customer_email: paymentInfo.sender_email,
        meta_data: {
          parcel_id: paymentInfo.parcel_id
        },
        success_url: `${process.env.MY_DOMAIN}/dashboard/payment-success`,
        cancel_url: `${process.env.MY_DOMAIN}/dashboard/payment-cancelled`,
      })
      console.log(session);
      res.send({ url: session.url });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

