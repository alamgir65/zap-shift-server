const express = require('express')
const cors = require('cors')
require('dotenv').config()
const app = express()
const port = process.env.PORT || 3000
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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

    // parcel all api's here

    app.get('/parcels', async(req, res) => {
      const query = {};
      const email = req.query.email;
      if(email){
        query.sender_email = email;
      }
      const cursor = parcelsCollection.find(query);
      const result = await cursor.toArray();
      res.send(result);
    })

    app.post('/parcels', async(req,res) => {
        const parcel = req.body;
        const result = await parcelsCollection.insertOne(parcel);
        res.send(result);
    })

    app.delete('/parcels/:id', async (req,res) => {
      const id = req.params.id;
      const query = {_id: new ObjectId(id)};
      const result = parcelsCollection.deleteOne(query);
      res.send(result);
    })

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
