const jwt = require("jsonwebtoken");
const userRepository = require("../repositories/userRepository");

const optionalAuth = async (req, _res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await userRepository.findById(decoded.id);
    if (user) {
      req.user = { id: user._id.toString(), _id: user._id };
      req.userId = user._id.toString();
    }
  } catch {
    // ignore invalid tokens and allow anonymous access
  }

  next();
};

module.exports = optionalAuth;
