const mongoose = require("mongoose");

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const leadCol = db.collection("leads");

  const total = await leadCol.countDocuments();
  console.log("Total leads:", total);

  const validStatusCounts = await leadCol.aggregate([
    { $group: { _id: "$validStatus", count: { $sum: 1 } } }
  ]).toArray();
  console.log("ValidStatus counts:", JSON.stringify(validStatusCounts, null, 2));

  const monthCounts = await leadCol.aggregate([
    { $group: { _id: "$month", count: { $sum: 1 } } },
    { $limit: 10 }
  ]).toArray();
  console.log("Month counts sample:", JSON.stringify(monthCounts, null, 2));

  const sampleLeads = await leadCol.find({}, { projection: { date: 1, month: 1, validStatus: 1, hospital: 1, doctor: 1, callerName: 1, disposition: 1, subDisposition: 1, leadSource: 1, apptDate: 1, surgeryDate: 1 } }).limit(5).toArray();
  console.log("Sample leads:", JSON.stringify(sampleLeads, null, 2));

  await mongoose.disconnect();
}
check().catch(console.error);
