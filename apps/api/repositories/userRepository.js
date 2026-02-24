const User = require("../../../backend/models/User");

const findOne = (filter) => User.findOne(filter);
const findById = (id) => User.findById(id);
const exists = (filter) => User.exists(filter);
const create = (doc) => User.create(doc);
const insertOne = (doc) => User.collection.insertOne(doc);

module.exports = {
  findOne,
  findById,
  exists,
  create,
  insertOne,
};
