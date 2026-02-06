const paginate = (req, maxLimit = 50) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(req.query.limit) || 10, 1),
    maxLimit
  );
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

module.exports = paginate;
