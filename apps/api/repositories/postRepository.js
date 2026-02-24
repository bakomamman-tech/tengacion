const Post = require("../models/Post");

const create = (doc) => Post.create(doc);
const findById = (id) => Post.findById(id);
const findOne = (filter) => Post.findOne(filter);
const findMany = (filter) => Post.find(filter);
const findOneAndDelete = (filter) => Post.findOneAndDelete(filter);
const deleteOne = (filter) => Post.deleteOne(filter);

module.exports = {
  create,
  findById,
  findOne,
  findMany,
  findOneAndDelete,
  deleteOne,
};
